"""Run Phase 1 training: CNN-only with augmentation + PAM encoding.

Uses existing Kim 2018 data (15K train, 1.3K val).
No RNA-FM required (CNN branch only → runs on CPU).

Improvements over previous training:
    - Gap 1: Sequence augmentation (RC + flanking shuffle)
    - Gap 7: PAM class encoding (9 enAsCas12a variants)
    - Normalised activity labels (quantile → [0, 1])

Usage:
    python compass-net/training/run_phase1.py
"""

from __future__ import annotations

import logging
import sys
import time
from pathlib import Path

import numpy as np
import torch
from scipy.stats import spearmanr
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingWarmRestarts
from torch.utils.data import DataLoader, Dataset

# Ensure imports work
ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "compass-net"))
sys.path.insert(0, str(ROOT))

import importlib, types

# Direct imports avoiding relative import issues
def _load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod

# Register compass-net sub-packages so relative imports work
CN = ROOT / "compass-net"
# Create package stubs
for pkg_name, pkg_path in [
    ("branches", CN / "branches"),
    ("heads", CN / "heads"),
    ("attention", CN / "attention"),
    ("losses", CN / "losses"),
]:
    pkg = types.ModuleType(f".{pkg_name}")
    pkg.__path__ = [str(pkg_path)]
    pkg.__package__ = pkg_name
    sys.modules[pkg_name] = pkg

# Load modules
_load_module("branches.cnn_branch", CN / "branches" / "cnn_branch.py")
_load_module("branches.rnafm_branch", CN / "branches" / "rnafm_branch.py")
_load_module("heads.discrimination_head", CN / "heads" / "discrimination_head.py")

# Spearman loss (needed by multitask_loss)
_load_module("losses.spearman_loss", CN / "losses" / "spearman_loss.py")
_load_module("losses.multitask_loss", CN / "losses" / "multitask_loss.py")

from branches.cnn_branch import CNNBranch
from heads.discrimination_head import DiscriminationHead
from losses.multitask_loss import MultiTaskLoss

# Load CompassML with its dependencies now resolved
_load_module("compass_ml_module", CN / "compass_ml.py")
from compass_ml_module import CompassML

from data.loaders.load_kim2018 import load_kim2018_domains
from data.augmentation import SequenceAugmenter
from training.reproducibility import seed_everything

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── PAM classification ──
# Map 4-nt PAM strings to enAsCas12a class indices (0-8)
PAM_CLASSES = {
    "TTTA": 0, "TTTC": 0, "TTTG": 0,  # TTTV → class 0
    "TTTT": 1,
    "TTCA": 2, "TTCC": 2, "TTCG": 2,  # TTCV → class 2
    "TATA": 3, "TATC": 3, "TATG": 3,  # TATV → class 3
    "CTTA": 4, "CTTC": 4, "CTTG": 4,  # CTTV → class 4
    "TCTA": 5, "TCTC": 5, "TCTG": 5,  # TCTV → class 5
    "TGTA": 6, "TGTC": 6, "TGTG": 6,  # TGTV → class 6
    "ATTA": 7, "ATTC": 7, "ATTG": 7,  # ATTV → class 7
    "GTTA": 8, "GTTC": 8, "GTTG": 8,  # GTTV → class 8
}


def classify_pam(seq_34: str) -> int:
    """Extract PAM class from 34-nt target sequence."""
    pam = seq_34[:4].upper()
    return PAM_CLASSES.get(pam, 0)


def seq_to_onehot(seq: str) -> np.ndarray:
    """Convert 34-nt DNA to (4, 34) one-hot [A, C, G, T]."""
    mapping = {"A": 0, "C": 1, "G": 2, "T": 3}
    oh = np.zeros((4, len(seq)), dtype=np.float32)
    for i, base in enumerate(seq.upper()):
        if base in mapping:
            oh[mapping[base], i] = 1.0
    return oh


def normalise_activities(raw: np.ndarray) -> np.ndarray:
    """Quantile-normalise raw indel frequencies to [0, 1]."""
    ranked = raw.argsort().argsort()  # rank transform
    return ranked.astype(np.float32) / max(len(raw) - 1, 1)


# ── Dataset ──
class Kim2018Dataset(Dataset):
    """Kim 2018 dataset with augmentation and PAM encoding."""

    def __init__(
        self,
        sequences: list[str],
        activities: np.ndarray,
        augmenter: SequenceAugmenter | None = None,
    ):
        self.sequences = sequences
        self.activities = activities.astype(np.float32)
        self.augmenter = augmenter
        self.pam_classes = np.array(
            [classify_pam(s) for s in sequences], dtype=np.int64,
        )

    def __len__(self):
        return len(self.sequences)

    def __getitem__(self, idx):
        oh = seq_to_onehot(self.sequences[idx])
        if self.augmenter is not None:
            oh = self.augmenter(oh)
        return {
            "target_onehot": torch.from_numpy(oh),
            "efficiency": torch.tensor(self.activities[idx]),
            "pam_class": torch.tensor(self.pam_classes[idx]),
        }


def collate_fn(batch):
    return {
        "target_onehot": torch.stack([b["target_onehot"] for b in batch]),
        "efficiency": torch.stack([b["efficiency"] for b in batch]),
        "pam_class": torch.stack([b["pam_class"] for b in batch]),
    }


# ── Training ──
def train():
    seed_everything(42)
    device = torch.device("cpu")

    # Load data
    logger.info("Loading Kim 2018 data...")
    data = load_kim2018_domains(
        str(ROOT / "compass" / "data" / "kim2018" / "nbt4061_source_data.xlsx"),
    )

    train_seqs = data["train_domains"][0]["sequences"]
    train_acts = np.array(data["train_domains"][0]["activities"])
    val_seqs = data["val_sequences"]
    val_acts = np.array(data["val_activities"])

    # Normalise
    train_acts_norm = normalise_activities(train_acts)
    val_acts_norm = normalise_activities(val_acts)

    logger.info("Train: %d sequences, Val: %d sequences", len(train_seqs), len(val_seqs))

    # Augmenter — RC + flanking shuffle (Gap 1)
    augmenter = SequenceAugmenter(rc_prob=0.5, shuffle_prob=0.3)

    train_ds = Kim2018Dataset(train_seqs, train_acts_norm, augmenter=augmenter)
    val_ds = Kim2018Dataset(val_seqs, val_acts_norm, augmenter=None)

    train_loader = DataLoader(
        train_ds, batch_size=256, shuffle=True, collate_fn=collate_fn,
        num_workers=0,
    )
    val_loader = DataLoader(
        val_ds, batch_size=512, shuffle=False, collate_fn=collate_fn,
        num_workers=0,
    )

    # Build model with new features
    model = CompassML(
        cnn_branches=40,
        cnn_out_dim=64,
        use_rnafm=False,          # CNN-only (no RNA-FM cache available)
        use_rloop_attention=False, # RLPA needs fused CNN+RNA-FM
        multitask=False,
        n_pam_classes=9,          # Gap 7: PAM encoding
        pam_embed_dim=8,
    )
    model = model.to(device)

    n_params = model.count_trainable_params()
    logger.info("Model: %d trainable params (CNN + PAM embedding)", n_params)

    # Loss
    loss_fn = MultiTaskLoss(lambda_disc=0.0, lambda_rank=0.5)

    # Optimiser
    optimizer = AdamW(model.parameters(), lr=1e-3, weight_decay=1e-3)
    scheduler = CosineAnnealingWarmRestarts(optimizer, T_0=50, T_mult=2, eta_min=1e-6)

    # Training loop
    save_path = ROOT / "compass" / "weights" / "compass_ml_phase1_v2.pt"
    save_path.parent.mkdir(parents=True, exist_ok=True)

    best_rho = -1.0
    patience_counter = 0
    n_epochs = 200
    patience = 20

    logger.info("Starting Phase 1 training (%d epochs, patience=%d)...", n_epochs, patience)
    t0 = time.time()

    for epoch in range(n_epochs):
        # Anneal Spearman strength
        spearman_s = max(0.1, 1.0 - 0.9 * epoch / n_epochs)
        loss_fn.set_spearman_strength(spearman_s)

        # Train
        model.train()
        train_loss = 0.0
        for batch in train_loader:
            target = batch["target_onehot"].to(device)
            eff = batch["efficiency"].to(device)
            pam = batch["pam_class"].to(device)

            # Label noise
            noise = torch.randn_like(eff) * 0.02
            eff_noisy = (eff + noise).clamp(0.0, 1.0)

            # Forward — pass PAM class to CNN branch
            # Note: CompassML.encode() calls self.cnn(target_onehot)
            # but CNNBranch.forward() now accepts pam_class
            # We need to pass it through — currently encode() doesn't forward pam_class
            # So we call cnn directly for now
            cnn_feat = model.cnn(target, pam_class=pam)
            pooled = model.pool(cnn_feat.permute(0, 2, 1)).squeeze(-1)
            pred = model.efficiency_head(pooled)

            losses = loss_fn(pred_eff=pred, true_eff=eff_noisy)

            optimizer.zero_grad()
            losses["total"].backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            train_loss += losses["total"].item()

        scheduler.step()
        train_loss /= max(len(train_loader), 1)

        # Validate
        model.eval()
        val_preds, val_targets = [], []
        val_loss = 0.0
        with torch.no_grad():
            for batch in val_loader:
                target = batch["target_onehot"].to(device)
                eff = batch["efficiency"].to(device)
                pam = batch["pam_class"].to(device)

                cnn_feat = model.cnn(target, pam_class=pam)
                pooled = model.pool(cnn_feat.permute(0, 2, 1)).squeeze(-1)
                pred = model.efficiency_head(pooled)

                losses = loss_fn(pred_eff=pred, true_eff=eff)
                val_loss += losses["total"].item()
                val_preds.extend(pred.squeeze(-1).cpu().tolist())
                val_targets.extend(eff.cpu().tolist())

        val_loss /= max(len(val_loader), 1)
        rho, _ = spearmanr(val_preds, val_targets)
        rho = float(rho) if not np.isnan(rho) else 0.0

        # Early stopping
        if rho > best_rho:
            best_rho = rho
            patience_counter = 0
            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "epoch": epoch,
                    "val_rho": rho,
                    "val_loss": val_loss,
                    "phase": 1,
                    "config": {
                        "cnn_branches": 40, "cnn_out_dim": 64,
                        "use_rnafm": False, "n_pam_classes": 9,
                        "pam_embed_dim": 8,
                    },
                    "augmentation": {"rc_prob": 0.5, "shuffle_prob": 0.3},
                },
                str(save_path),
            )
        else:
            patience_counter += 1

        if (epoch + 1) % 10 == 0 or patience_counter == 0:
            elapsed = time.time() - t0
            logger.info(
                "Epoch %3d/%d | Train: %.4f | Val: %.4f | "
                "ρ: %.4f | Best: %.4f | LR: %.2e | %.0fs",
                epoch + 1, n_epochs, train_loss, val_loss,
                rho, best_rho, scheduler.get_last_lr()[0], elapsed,
            )

        if patience_counter >= patience:
            logger.info("Early stopping at epoch %d. Best ρ = %.4f", epoch + 1, best_rho)
            break

    elapsed = time.time() - t0
    logger.info("Training complete in %.1f seconds. Best ρ = %.4f", elapsed, best_rho)
    logger.info("Checkpoint saved to %s", save_path)

    # Load best and report
    ckpt = torch.load(str(save_path), map_location=device, weights_only=False)
    logger.info(
        "Best model: epoch %d, val_rho=%.4f, val_loss=%.4f",
        ckpt["epoch"] + 1, ckpt["val_rho"], ckpt["val_loss"],
    )


if __name__ == "__main__":
    train()
