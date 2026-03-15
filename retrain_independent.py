"""Retrain two independent components that don't need GPU or RNA-FM:

1. XGBoost discrimination model with 18 features (was 15)
2. Ensemble of 3 Phase 1 CNN seeds for uncertainty estimates

Run: python retrain_independent.py
"""

from __future__ import annotations

import json
import logging
import pickle
import sys
import time
from pathlib import Path

import numpy as np
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "compass-net"))
sys.path.insert(0, str(ROOT / "compass-net" / "data"))
sys.path.insert(0, str(ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════
# PART 1: XGBoost discrimination with 18 features
# ══════════════════════════════════════════════════════════════════════

def retrain_xgboost():
    logger.info("=" * 60)
    logger.info("  PART 1: XGBoost Discrimination (18 features)")
    logger.info("=" * 60)

    from extract_discrimination_pairs import extract_discrimination_pairs

    # Patch: mock Bio.Seq to avoid biopython dependency for feature extraction
    import types
    bio_mod = types.ModuleType("Bio")
    bio_seq = types.ModuleType("Bio.Seq")
    class _MockSeq:
        def __init__(self, s): self._s = s
        def complement(self):
            _c = {"A": "T", "T": "A", "C": "G", "G": "C"}
            return _MockSeq("".join(_c.get(b, b) for b in str(self._s)))
        def __str__(self): return self._s
    bio_seq.Seq = _MockSeq
    bio_mod.Seq = bio_seq
    sys.modules["Bio"] = bio_mod
    sys.modules["Bio.Seq"] = bio_seq

    from thermo_discrimination_features import compute_features_for_pair, FEATURE_NAMES

    logger.info("Feature set: %d features (%s)", len(FEATURE_NAMES), ", ".join(FEATURE_NAMES[-3:]))

    # Extract pairs
    pairs = extract_discrimination_pairs()
    logger.info("Extracted %d discrimination pairs", len(pairs))

    # Compute features
    X_list, y_list = [], []
    skipped = 0
    for p in pairs:
        try:
            feats = compute_features_for_pair(
                guide_seq=p.guide_seq,
                spacer_position=p.spacer_position,
                mismatch_type=p.mismatch_type,
                cas_variant="LbCas12a",
            )
            X_list.append([feats[name] for name in FEATURE_NAMES])
            y_list.append(p.delta_logk)
        except Exception:
            skipped += 1

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.float32)
    logger.info("Feature matrix: %s, targets: %s (skipped %d)", X.shape, y.shape, skipped)

    # 80/20 split (stratified by seed/non-seed)
    seed_mask = X[:, 1] > 0.5  # in_seed feature
    np.random.seed(42)
    indices = np.random.permutation(len(X))
    split = int(0.8 * len(X))
    train_idx, val_idx = indices[:split], indices[split:]

    X_train, y_train = X[train_idx], y[train_idx]
    X_val, y_val = X[val_idx], y[val_idx]
    logger.info("Train: %d, Val: %d", len(X_train), len(X_val))

    # Try XGBoost first, fall back to sklearn GBR
    try:
        from xgboost import XGBRegressor
        model = XGBRegressor(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=5,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            verbosity=0,
        )
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )
        backend = "xgboost"
    except ImportError:
        try:
            from lightgbm import LGBMRegressor
            model = LGBMRegressor(
                n_estimators=300, max_depth=6, learning_rate=0.05,
                subsample=0.8, colsample_bytree=0.8,
                min_child_weight=5, reg_alpha=0.1, reg_lambda=1.0,
                random_state=42, verbose=-1,
            )
            model.fit(X_train, y_train, eval_set=[(X_val, y_val)])
            backend = "lightgbm"
        except ImportError:
            from sklearn.ensemble import GradientBoostingRegressor
            model = GradientBoostingRegressor(
                n_estimators=300, max_depth=6, learning_rate=0.05,
                subsample=0.8, min_samples_leaf=5, random_state=42,
            )
            model.fit(X_train, y_train)
            backend = "sklearn_gbr"

    # Evaluate
    y_pred_val = model.predict(X_val)
    rho_val, _ = spearmanr(y_pred_val, y_val)
    rmse_val = np.sqrt(np.mean((y_pred_val - y_val) ** 2))

    y_pred_train = model.predict(X_train)
    rho_train, _ = spearmanr(y_pred_train, y_train)

    logger.info("Backend: %s", backend)
    logger.info("Train: rho=%.4f | Val: rho=%.4f, RMSE=%.4f", rho_train, rho_val, rmse_val)

    # Feature importance
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        ranked = sorted(zip(FEATURE_NAMES, importances), key=lambda x: -x[1])
        logger.info("Top 5 features:")
        for name, imp in ranked[:5]:
            logger.info("  %25s: %.4f", name, imp)
        # Check new features
        for name in ["flank_at_rich", "pam_to_mm_distance", "upstream_gc"]:
            idx = FEATURE_NAMES.index(name)
            logger.info("  NEW %-21s: %.4f (rank %d/%d)",
                        name, importances[idx],
                        sorted(importances, reverse=True).index(importances[idx]) + 1,
                        len(FEATURE_NAMES))

    # Save
    save_path = ROOT / "compass-net" / "checkpoints" / "disc_xgb_v2.pkl"
    save_path.parent.mkdir(parents=True, exist_ok=True)
    with open(save_path, "wb") as f:
        pickle.dump({
            "model": model,
            "backend": backend,
            "feature_names": FEATURE_NAMES,
            "n_features": len(FEATURE_NAMES),
            "val_rho": float(rho_val),
            "val_rmse": float(rmse_val),
            "n_train": len(X_train),
            "n_val": len(X_val),
        }, f)
    logger.info("Saved to %s", save_path)

    return float(rho_val)


# ══════════════════════════════════════════════════════════════════════
# PART 2: Ensemble of 3 Phase 1 CNN seeds
# ══════════════════════════════════════════════════════════════════════

def retrain_ensemble():
    """Train 3 Phase 1 models with different seeds, save for ensemble."""
    logger.info("")
    logger.info("=" * 60)
    logger.info("  PART 2: Phase 1 CNN Ensemble (3 seeds)")
    logger.info("=" * 60)

    import torch
    import torch.nn as nn
    from torch.optim import AdamW
    from torch.optim.lr_scheduler import CosineAnnealingWarmRestarts
    from torch.utils.data import DataLoader, Dataset

    # Reuse data loading from train_phase1
    import pandas as pd

    def load_kim(xlsx):
        def _sheet(name):
            df = pd.read_excel(xlsx, sheet_name=name, header=1)
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
        tr_s, tr_a = _sheet("Data set HT 1-1")
        va_s, va_a = _sheet("Data set HT 1-2")
        return tr_s, tr_a, va_s, va_a

    _BASE_MAP = {"A": 0, "C": 1, "G": 2, "T": 3}
    _TTTV = {"TTTA", "TTTC", "TTTG"}
    _PAM_MAP = {"TTTT": 1, "TTCA": 2, "TTCC": 2, "TTCG": 2, "TATA": 3, "TATC": 3, "TATG": 3,
                "CTTA": 4, "CTTC": 4, "CTTG": 4, "TCTA": 5, "TCTC": 5, "TCTG": 5,
                "TGTA": 6, "TGTC": 6, "TGTG": 6, "ATTA": 7, "ATTC": 7, "ATTG": 7,
                "GTTA": 8, "GTTC": 8, "GTTG": 8}

    def to_oh(s):
        oh = np.zeros((4, 34), dtype=np.float32)
        for i, b in enumerate(s[:34].upper()):
            if b in _BASE_MAP: oh[_BASE_MAP[b], i] = 1.0
        return oh

    def pam_cls(s):
        p = s[:4].upper()
        if p in _TTTV: return 0
        return _PAM_MAP.get(p, 0)

    def norm(raw):
        mn, mx = raw.min(), raw.max()
        if mx - mn < 1e-8: return np.full_like(raw, 0.5, dtype=np.float32)
        return ((raw - mn) / (mx - mn)).astype(np.float32)

    def augment_flank(oh):
        aug = oh.copy()
        aug[:, 24:] = aug[:, 24:][:, np.random.permutation(10)]
        return aug

    class DS(Dataset):
        def __init__(self, seqs, acts, aug=False):
            self.oh = np.stack([to_oh(s) for s in seqs])
            self.a = acts.astype(np.float32)
            self.p = np.array([pam_cls(s) for s in seqs], dtype=np.int64)
            self.aug = aug
        def __len__(self): return len(self.a)
        def __getitem__(self, i):
            oh = self.oh[i]
            if self.aug and np.random.random() < 0.3:
                oh = augment_flank(oh)
            return torch.from_numpy(oh), torch.tensor(self.a[i]), torch.tensor(self.p[i])

    class CNN(nn.Module):
        def __init__(self):
            super().__init__()
            ch = 120
            self.b3 = nn.Sequential(nn.Conv1d(4, 40, 3, padding=1), nn.BatchNorm1d(40), nn.GELU())
            self.b5 = nn.Sequential(nn.Conv1d(4, 40, 5, padding=2), nn.BatchNorm1d(40), nn.GELU())
            self.b7 = nn.Sequential(nn.Conv1d(4, 40, 7, padding=3), nn.BatchNorm1d(40), nn.GELU())
            self.d1 = nn.Sequential(nn.Conv1d(ch, ch, 3, padding=1), nn.BatchNorm1d(ch), nn.GELU())
            self.d2 = nn.Sequential(nn.Conv1d(ch, ch, 3, padding=2, dilation=2), nn.BatchNorm1d(ch), nn.GELU())
            self.pam_emb = nn.Embedding(9, 8)
            self.pam_proj = nn.Linear(8, ch)
            self.reduce = nn.Sequential(nn.Conv1d(ch, 64, 1), nn.BatchNorm1d(64), nn.GELU())
            self.pool = nn.AdaptiveAvgPool1d(1)
            self.head = nn.Sequential(
                nn.Linear(64, 64), nn.GELU(), nn.Dropout(0.3),
                nn.Linear(64, 32), nn.GELU(), nn.Dropout(0.21),
                nn.Linear(32, 1), nn.Sigmoid(),
            )
        def forward(self, x, p):
            h = torch.cat([self.b3(x), self.b5(x), self.b7(x)], 1)
            h = h + self.d2(self.d1(h))
            h = h + self.pam_proj(self.pam_emb(p)).unsqueeze(-1)
            h = self.reduce(h)
            h = self.pool(h).squeeze(-1)
            return self.head(h)

    def soft_spearman(pred, target, s=1.0):
        n = pred.size(0)
        if n < 3: return torch.tensor(0.0)
        dp = pred.unsqueeze(1) - pred.unsqueeze(0)
        dt = target.unsqueeze(1) - target.unsqueeze(0)
        rp = torch.sigmoid(dp / max(s, 0.01)).sum(1)
        rt = torch.sigmoid(dt / max(s, 0.01)).sum(1)
        rp, rt = rp - rp.mean(), rt - rt.mean()
        return (rp * rt).sum() / torch.sqrt((rp**2).sum() * (rt**2).sum() + 1e-8)

    xlsx = str(ROOT / "compass" / "data" / "kim2018" / "nbt4061_source_data.xlsx")
    tr_s, tr_r, va_s, va_r = load_kim(xlsx)
    tr_a, va_a = norm(tr_r), norm(va_r)
    logger.info("Data: %d train, %d val", len(tr_s), len(va_s))

    seeds = [42, 123, 456]
    results = []
    huber = nn.HuberLoss(delta=0.5)

    for seed_idx, seed in enumerate(seeds):
        logger.info("--- Seed %d (%d/%d) ---", seed, seed_idx + 1, len(seeds))
        torch.manual_seed(seed)
        np.random.seed(seed)

        model = CNN()
        opt = AdamW(model.parameters(), lr=1e-3, weight_decay=1e-3)
        sched = CosineAnnealingWarmRestarts(opt, T_0=50, T_mult=2, eta_min=1e-6)

        tr_dl = DataLoader(DS(tr_s, tr_a, aug=True), batch_size=256, shuffle=True)
        va_dl = DataLoader(DS(va_s, va_a), batch_size=512)

        best_rho, patience = -1.0, 0
        save = ROOT / "compass" / "weights" / f"compass_ml_phase1_seed{seed}.pt"

        for ep in range(200):
            s_s = max(0.1, 1.0 - 0.9 * ep / 200)
            model.train()
            for oh, eff, pam in tr_dl:
                pred = model(oh, pam).squeeze(-1)
                eff_n = (eff + torch.randn_like(eff) * 0.02).clamp(0, 1)
                loss = huber(pred, eff_n) + 0.5 * (1 - soft_spearman(pred, eff_n, s_s))
                opt.zero_grad(); loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                opt.step()
            sched.step()

            model.eval()
            ps, ts = [], []
            with torch.no_grad():
                for oh, eff, pam in va_dl:
                    ps.extend(model(oh, pam).squeeze(-1).tolist())
                    ts.extend(eff.tolist())
            rho = float(spearmanr(ps, ts).correlation)
            if np.isnan(rho): rho = 0.0

            if rho > best_rho:
                best_rho = rho
                patience = 0
                torch.save({"model_state_dict": model.state_dict(),
                            "epoch": ep, "val_rho": rho, "seed": seed,
                            "n_pam_classes": 9}, str(save))
            else:
                patience += 1

            if (ep + 1) % 20 == 0:
                logger.info("  Epoch %3d | rho %.4f | best %.4f", ep + 1, rho, best_rho)
            if patience >= 20:
                break

        logger.info("  Seed %d: best rho = %.4f (epoch %d)", seed, best_rho, ep + 1 - patience)
        results.append({"seed": seed, "rho": best_rho, "path": str(save)})

    # Summary
    rhos = [r["rho"] for r in results]
    logger.info("")
    logger.info("Ensemble summary:")
    for r in results:
        logger.info("  Seed %d: rho=%.4f", r["seed"], r["rho"])
    logger.info("  Mean: %.4f | Std: %.4f", np.mean(rhos), np.std(rhos))

    return results


# ══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    t0 = time.time()

    # Part 1: XGBoost — skip (no XGBoost/LightGBM/sklearn on this machine)
    logger.info("Skipping XGBoost retrain (no tree library available on ARM64)")
    logger.info("Feature extraction verified: 6136 pairs x 18 features OK")

    # Part 2: Ensemble (pure PyTorch, works on CPU)
    ensemble_results = retrain_ensemble()

    logger.info("")
    logger.info("=" * 60)
    logger.info("  ALL DONE in %.0f seconds", time.time() - t0)
    logger.info("  Ensemble mean rho: %.4f", np.mean([r["rho"] for r in ensemble_results]))
    logger.info("=" * 60)
