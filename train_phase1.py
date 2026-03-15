"""Phase 1 training: CNN + PAM encoding + augmentation on Kim 2018.

Standalone script at repo root — avoids relative import issues.
Run: python train_phase1.py
"""

from __future__ import annotations

import logging
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from scipy.stats import spearmanr
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingWarmRestarts
from torch.utils.data import DataLoader, Dataset

ROOT = Path(__file__).resolve().parent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Kim 2018 data loading (inline to avoid import chain) ──
import pandas as pd


def load_kim2018(xlsx_path: str):
    """Load Kim 2018 HT datasets."""
    def _load_sheet(sheet_name):
        df = pd.read_excel(xlsx_path, sheet_name=sheet_name, header=1)
        seq_col = next((c for c in df.columns if "34" in str(c)), df.columns[1])
        indel_col = next(
            (c for c in df.columns if "Background" in str(c) and "subtract" in str(c).lower()),
            df.columns[-1],
        )
        valid = pd.DataFrame({"seq": df[seq_col], "indel": df[indel_col]}).dropna()
        seqs = valid["seq"].astype(str).values
        indels = valid["indel"].values.astype(np.float64)
        mask = np.array([len(s) == 34 and all(c in "ACGTacgt" for c in s) for s in seqs])
        return [s.upper() for s in seqs[mask]], np.clip(indels[mask], 0, None)

    train_seqs, train_acts = _load_sheet("Data set HT 1-1")
    val_seqs, val_acts = _load_sheet("Data set HT 1-2")
    return train_seqs, train_acts, val_seqs, val_acts


# ── Augmentation (inline from Gap 1) ──
_COMPLEMENT_IDX = np.array([3, 2, 1, 0])  # A↔T(3↔0), C↔G(1↔2)


def augment_rc(oh: np.ndarray) -> np.ndarray:
    """Reverse complement one-hot (4, 34)."""
    return oh[_COMPLEMENT_IDX, ::-1].copy()


def augment_shuffle_flank(oh: np.ndarray) -> np.ndarray:
    """Shuffle downstream flanking (positions 24-33)."""
    aug = oh.copy()
    perm = np.random.permutation(10)
    aug[:, 24:] = aug[:, 24:][:, perm]
    return aug


# ── PAM classification ──
_TTTV = {"TTTA", "TTTC", "TTTG"}


def classify_pam(seq: str) -> int:
    """Classify PAM from 34-nt target. 0=TTTV, 1=TTTT, 2-8=expanded."""
    pam = seq[:4].upper()
    if pam in _TTTV:
        return 0
    mapping = {
        "TTTT": 1, "TTCA": 2, "TTCC": 2, "TTCG": 2,
        "TATA": 3, "TATC": 3, "TATG": 3,
        "CTTA": 4, "CTTC": 4, "CTTG": 4,
        "TCTA": 5, "TCTC": 5, "TCTG": 5,
        "TGTA": 6, "TGTC": 6, "TGTG": 6,
        "ATTA": 7, "ATTC": 7, "ATTG": 7,
        "GTTA": 8, "GTTC": 8, "GTTG": 8,
    }
    return mapping.get(pam, 0)


# ── One-hot encoding ──
_BASE_MAP = {"A": 0, "C": 1, "G": 2, "T": 3}


def to_onehot(seq: str) -> np.ndarray:
    oh = np.zeros((4, 34), dtype=np.float32)
    for i, b in enumerate(seq[:34].upper()):
        if b in _BASE_MAP:
            oh[_BASE_MAP[b], i] = 1.0
    return oh


def normalise(raw: np.ndarray) -> np.ndarray:
    """Min-max normalise raw indel frequencies to [0, 1]."""
    mn, mx = raw.min(), raw.max()
    if mx - mn < 1e-8:
        return np.full_like(raw, 0.5, dtype=np.float32)
    return ((raw - mn) / (mx - mn)).astype(np.float32)


# ── Dataset ──
class GuideDataset(Dataset):
    def __init__(self, seqs, acts, augment=False):
        self.onehots = np.stack([to_onehot(s) for s in seqs])
        self.acts = acts.astype(np.float32)
        self.pams = np.array([classify_pam(s) for s in seqs], dtype=np.int64)
        self.augment = augment

    def __len__(self):
        return len(self.acts)

    def __getitem__(self, i):
        oh = self.onehots[i]
        if self.augment:
            # NOTE: RC augmentation is biologically INVALID for Cas12a —
            # PAM must be 5' upstream, RC flips it to wrong end. Disabled.
            # Only flanking shuffle is strand-safe.
            if np.random.random() < 0.3:
                oh = augment_shuffle_flank(oh)
        return (
            torch.from_numpy(oh),
            torch.tensor(self.acts[i]),
            torch.tensor(self.pams[i]),
        )


# ── Model (CNN-only with PAM encoding, no relative imports) ──
class CNNBranch(nn.Module):
    def __init__(self, branches=40, out_dim=64, n_pam=9, pam_dim=8):
        super().__init__()
        ch = branches * 3
        self.b3 = nn.Sequential(nn.Conv1d(4, branches, 3, padding=1), nn.BatchNorm1d(branches), nn.GELU())
        self.b5 = nn.Sequential(nn.Conv1d(4, branches, 5, padding=2), nn.BatchNorm1d(branches), nn.GELU())
        self.b7 = nn.Sequential(nn.Conv1d(4, branches, 7, padding=3), nn.BatchNorm1d(branches), nn.GELU())
        self.d1 = nn.Sequential(nn.Conv1d(ch, ch, 3, padding=1, dilation=1), nn.BatchNorm1d(ch), nn.GELU())
        self.d2 = nn.Sequential(nn.Conv1d(ch, ch, 3, padding=2, dilation=2), nn.BatchNorm1d(ch), nn.GELU())
        self.pam_emb = nn.Embedding(n_pam, pam_dim)
        self.pam_proj = nn.Linear(pam_dim, ch)
        self.reduce = nn.Sequential(nn.Conv1d(ch, out_dim, 1), nn.BatchNorm1d(out_dim), nn.GELU())

    def forward(self, x, pam):
        h = torch.cat([self.b3(x), self.b5(x), self.b7(x)], dim=1)
        h = h + self.d2(self.d1(h))
        h = h + self.pam_proj(self.pam_emb(pam)).unsqueeze(-1)
        h = self.reduce(h)
        return h


class Phase1Model(nn.Module):
    def __init__(self):
        super().__init__()
        self.cnn = CNNBranch(branches=40, out_dim=64, n_pam=9, pam_dim=8)
        self.pool = nn.AdaptiveAvgPool1d(1)
        self.head = nn.Sequential(
            nn.Linear(64, 64), nn.GELU(), nn.Dropout(0.3),
            nn.Linear(64, 32), nn.GELU(), nn.Dropout(0.21),
            nn.Linear(32, 1), nn.Sigmoid(),
        )

    def forward(self, x, pam):
        feat = self.cnn(x, pam)
        pooled = self.pool(feat).squeeze(-1)
        return self.head(pooled)


# ── Differentiable Spearman ──
def soft_spearman(pred, target, s=1.0):
    """Sigmoid-approximation differentiable Spearman."""
    n = pred.size(0)
    if n < 3:
        return torch.tensor(0.0, device=pred.device)
    # Pairwise differences for soft ranking
    diff_p = pred.unsqueeze(1) - pred.unsqueeze(0)
    diff_t = target.unsqueeze(1) - target.unsqueeze(0)
    rank_p = torch.sigmoid(diff_p / max(s, 0.01)).sum(dim=1)
    rank_t = torch.sigmoid(diff_t / max(s, 0.01)).sum(dim=1)
    # Pearson on ranks
    rp = rank_p - rank_p.mean()
    rt = rank_t - rank_t.mean()
    num = (rp * rt).sum()
    den = torch.sqrt((rp ** 2).sum() * (rt ** 2).sum() + 1e-8)
    return num / den


# ── Training ──
def main():
    logger.info("=" * 60)
    logger.info("  COMPASS Phase 1: CNN + PAM + Augmentation")
    logger.info("=" * 60)

    xlsx = str(ROOT / "compass" / "data" / "kim2018" / "nbt4061_source_data.xlsx")
    logger.info("Loading Kim 2018 from %s ...", xlsx)

    train_seqs, train_raw, val_seqs, val_raw = load_kim2018(xlsx)
    train_acts = normalise(train_raw)
    val_acts = normalise(val_raw)
    logger.info("Train: %d | Val: %d", len(train_seqs), len(val_seqs))

    train_ds = GuideDataset(train_seqs, train_acts, augment=True)
    val_ds = GuideDataset(val_seqs, val_acts, augment=False)

    train_loader = DataLoader(train_ds, batch_size=256, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=512, shuffle=False, num_workers=0)

    model = Phase1Model()
    n_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    logger.info("Model: %d trainable params", n_params)

    huber = nn.HuberLoss(delta=0.5)
    optimizer = AdamW(model.parameters(), lr=1e-3, weight_decay=1e-3)
    scheduler = CosineAnnealingWarmRestarts(optimizer, T_0=50, T_mult=2, eta_min=1e-6)

    save_path = ROOT / "compass" / "weights" / "compass_ml_phase1_v2.pt"
    best_rho = -1.0
    patience_counter = 0
    t0 = time.time()

    for epoch in range(200):
        s_strength = max(0.1, 1.0 - 0.9 * epoch / 200)

        # Train
        model.train()
        tloss = 0.0
        for oh, eff, pam in train_loader:
            noise = torch.randn_like(eff) * 0.02
            eff_n = (eff + noise).clamp(0, 1)
            pred = model(oh, pam).squeeze(-1)
            l_hub = huber(pred, eff_n)
            l_spear = 1.0 - soft_spearman(pred, eff_n, s=s_strength)
            loss = l_hub + 0.5 * l_spear
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            tloss += loss.item()
        scheduler.step()
        tloss /= max(len(train_loader), 1)

        # Validate
        model.eval()
        preds, tgts = [], []
        vloss = 0.0
        with torch.no_grad():
            for oh, eff, pam in val_loader:
                pred = model(oh, pam).squeeze(-1)
                l = huber(pred, eff)
                vloss += l.item()
                preds.extend(pred.tolist())
                tgts.extend(eff.tolist())
        vloss /= max(len(val_loader), 1)
        rho = float(spearmanr(preds, tgts).correlation)
        if np.isnan(rho):
            rho = 0.0

        if rho > best_rho:
            best_rho = rho
            patience_counter = 0
            torch.save({
                "model_state_dict": model.state_dict(),
                "epoch": epoch, "val_rho": rho, "val_loss": vloss,
                "n_params": n_params,
                "augmentation": "RC(0.5)+FlankShuffle(0.3)+LabelNoise(0.02)",
                "pam_classes": 9,
            }, str(save_path))
        else:
            patience_counter += 1

        if (epoch + 1) % 10 == 0 or patience_counter == 0:
            logger.info(
                "Epoch %3d | Train %.4f | Val %.4f | rho %.4f | Best %.4f | %s%.0fs",
                epoch + 1, tloss, vloss, rho, best_rho,
                "*" if patience_counter == 0 else " ",
                time.time() - t0,
            )

        if patience_counter >= 20:
            logger.info("Early stopping at epoch %d", epoch + 1)
            break

    logger.info("=" * 60)
    logger.info("  DONE. Best rho = %.4f | Saved to %s", best_rho, save_path)
    logger.info("  Time: %.1f seconds", time.time() - t0)
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
