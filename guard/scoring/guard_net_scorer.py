"""GUARD-Net scorer adapter for the GUARD pipeline.

Bridges the standalone GUARD-Net model (guard-net/) with the pipeline's
Module 5 scoring interface. Replaces SequenceMLScorer when GUARD-Net
weights are available.

Architecture: dual-branch CNN + RNA-FM with optional RLPA attention.
The CNN branch processes target DNA (34-nt one-hot), the RNA-FM branch
processes crRNA spacer embeddings (pre-cached). RLPA adds biophysically-
informed causal attention encoding Cas12a R-loop directionality.

When RNA-FM embeddings are unavailable (cache miss), falls back to
CNN-only scoring which is still superior to the old SeqCNN v1.

Usage in runner.py:
    scorer = GUARDNetScorer(
        weights_path="guard/weights/guard_net_best.pt",
        rnafm_cache_dir="guard/data/embeddings/rnafm",
    )
    scored = scorer.score_batch(candidates, offtargets)
"""

from __future__ import annotations

import json
import logging
import math
import sys
from pathlib import Path
from typing import Optional

import numpy as np

from guard.core.types import (
    CrRNACandidate,
    HeuristicScore,
    MLScore,
    OffTargetReport,
    ScoredCandidate,
)
from guard.scoring.base import Scorer
from guard.scoring.preprocessing import extract_input_window, one_hot_encode

logger = logging.getLogger(__name__)

_CONTEXT_LENGTH = 34
_GUARD_NET_DIR = Path(__file__).resolve().parent.parent.parent / "guard-net"
_DEFAULT_WEIGHTS = Path(__file__).resolve().parent.parent / "weights" / "guard_net_diagnostic.pt"
_DEFAULT_CALIBRATION = Path(__file__).resolve().parent.parent / "weights" / "guard_net_calibration.json"

# Complement tables
_DNA_COMPLEMENT = {"A": "T", "T": "A", "C": "G", "G": "C", "N": "N"}
_DNA_TO_RNA_RC = {"A": "U", "T": "A", "C": "G", "G": "C", "N": "N"}


class GUARDNetScorer(Scorer):
    """Pipeline-compatible scorer using GUARD-Net.

    Implements the Scorer interface (score/score_batch) so the pipeline
    can use it as a drop-in replacement for SequenceMLScorer.

    The model runs on CPU by default — at 235K params, single-sample
    inference takes <1ms, and batched inference is negligible.
    """

    def __init__(
        self,
        weights_path: Optional[str | Path] = None,
        heuristic_fallback: Optional[Scorer] = None,
        rnafm_cache_dir: Optional[str | Path] = None,
        calibration_path: Optional[str | Path] = None,
        use_rlpa: bool = True,
        use_rnafm: bool = True,
        multitask: bool = False,
        device: str = "cpu",
    ) -> None:
        self.model = None
        self._fallback = heuristic_fallback
        self._device_name = device
        self._device = None
        self._val_rho: Optional[float] = None
        self._use_rnafm = use_rnafm
        self._use_rlpa = use_rlpa
        self._multitask = multitask
        self._rnafm_cache = None

        # Calibration parameters
        self.temperature: float = 1.0
        self.alpha: float = 0.0
        self.calibrated: bool = False
        self._calibration_meta: dict = {}

        # Resolve weights path
        if weights_path is None:
            weights_path = _DEFAULT_WEIGHTS
        weights_path = Path(weights_path)

        if weights_path.exists():
            self._load_model(weights_path, use_rnafm, use_rlpa, multitask)
        else:
            logger.warning(
                "GUARD-Net weights not found at %s — scorer will use heuristic fallback",
                weights_path,
            )

        # Load calibration
        cal_path = Path(calibration_path) if calibration_path else _DEFAULT_CALIBRATION
        self._load_calibration(cal_path)

        # Load RNA-FM embedding cache
        if use_rnafm and rnafm_cache_dir is not None:
            cache_path = Path(rnafm_cache_dir)
            if cache_path.exists():
                self._load_rnafm_cache(cache_path)
            else:
                self._use_rnafm = False
                logger.info(
                    "RNA-FM cache dir %s not found — using CNN-only mode",
                    cache_path,
                )

    @property
    def validation_rho(self) -> Optional[float]:
        return self._val_rho

    @property
    def calibration_meta(self) -> dict:
        return dict(self._calibration_meta)

    def calibrated_score(self, raw_score: float) -> float:
        """Apply temperature calibration: sigmoid(logit(raw) / T).

        Spreads compressed sigmoid outputs so threshold decisions
        (efficiency >= 0.4, etc.) work on a properly scaled range.
        """
        if not self.calibrated or self.temperature <= 0:
            return raw_score
        clamped = max(1e-7, min(1 - 1e-7, raw_score))
        logit = math.log(clamped / (1 - clamped))
        return 1.0 / (1.0 + math.exp(-logit / self.temperature))

    def ensemble_score_val(self, heuristic_score: float, gn_calibrated: float) -> float:
        """Compute ensemble: alpha * heuristic + (1 - alpha) * calibrated_gn."""
        return self.alpha * heuristic_score + (1 - self.alpha) * gn_calibrated

    # Alias so the pipeline runner's manual loop can call the same interface
    # as SequenceMLScorer (which defines ensemble_score without the _val suffix).
    def ensemble_score(self, heuristic_score: float, gn_calibrated: float) -> float:
        return self.ensemble_score_val(heuristic_score, gn_calibrated)

    def score(
        self,
        candidate: CrRNACandidate,
        offtarget: OffTargetReport,
    ) -> ScoredCandidate:
        """Score a single candidate.

        Always computes heuristic as the base score (composite_score uses it).
        Adds GUARD-Net prediction as an MLScore if model is available.
        When calibrated, populates cnn_calibrated and ensemble_score fields
        so composite_score and Block 3 thresholds use calibrated values.
        """
        # Heuristic baseline (required — composite_score delegates to it)
        if self._fallback:
            base = self._fallback.score(candidate, offtarget)
        else:
            from guard.scoring.heuristic import HeuristicScorer
            base = HeuristicScorer().score(candidate, offtarget)

        # Add GUARD-Net prediction
        if self.model is not None:
            prediction = self._predict_single(candidate)
            base.ml_scores.append(MLScore(
                model_name="guard_net",
                predicted_efficiency=prediction,
            ))
            base.cnn_score = prediction

            # Apply calibration
            if self.calibrated:
                cal = self.calibrated_score(prediction)
                base.cnn_calibrated = cal
                base.ensemble_score = self.ensemble_score_val(
                    base.heuristic.composite, cal,
                )

        return base

    def score_batch(
        self,
        candidates: list[CrRNACandidate],
        offtargets: list[OffTargetReport],
    ) -> list[ScoredCandidate]:
        """Score and rank a batch of candidates."""
        if self.model is None:
            return super().score_batch(candidates, offtargets)

        # Batch encode and predict
        contexts = [self._encode_context(c) for c in candidates]
        rnafm_embs = [self._get_rnafm_embedding(c) for c in candidates]
        predictions = self._predict_batch(contexts, rnafm_embs)

        scored = []
        for c, o, pred in zip(candidates, offtargets, predictions):
            s = self.score(c, o)
            s.ml_scores = [MLScore(model_name="guard_net", predicted_efficiency=pred)]
            s.cnn_score = pred

            # Apply calibration to batch predictions
            if self.calibrated:
                cal = self.calibrated_score(pred)
                s.cnn_calibrated = cal
                s.ensemble_score = self.ensemble_score_val(
                    s.heuristic.composite, cal,
                )

            scored.append(s)

        scored.sort(key=lambda s: self._sort_key(s), reverse=True)
        for i, s in enumerate(scored):
            s.rank = i + 1
        return scored

    def predict_efficiency(self, candidate: CrRNACandidate) -> float:
        """Predict efficiency score only (no heuristic, no ScoredCandidate wrapper)."""
        if self.model is None:
            return 0.5
        return self._predict_single(candidate)

    def predict_with_discrimination(
        self,
        candidate: CrRNACandidate,
        wt_context_34: Optional[str] = None,
    ) -> dict[str, float]:
        """Predict efficiency and optionally discrimination ratio.

        Args:
            candidate: The crRNA candidate (mutant target).
            wt_context_34: 34-nt wildtype target DNA string. If provided
                and model has multitask head, returns discrimination too.

        Returns:
            dict with "efficiency" and optionally "discrimination".
        """
        if self.model is None:
            return {"efficiency": 0.5}

        import torch

        context = self._encode_context(candidate)
        target_tensor = torch.tensor(context, dtype=torch.float32).unsqueeze(0)
        target_tensor = target_tensor.to(self._device)

        rnafm_emb = self._get_rnafm_embedding(candidate)
        rnafm_tensor = None
        if rnafm_emb is not None:
            rnafm_tensor = torch.tensor(rnafm_emb, dtype=torch.float32).unsqueeze(0)
            rnafm_tensor = rnafm_tensor.to(self._device)

        wt_tensor = None
        if wt_context_34 is not None and self._multitask:
            wt_onehot = one_hot_encode(wt_context_34, max_len=_CONTEXT_LENGTH)
            wt_tensor = torch.tensor(wt_onehot, dtype=torch.float32).unsqueeze(0)
            wt_tensor = wt_tensor.to(self._device)

        with torch.no_grad():
            output = self.model(
                target_onehot=target_tensor,
                crrna_rnafm_emb=rnafm_tensor,
                wt_target_onehot=wt_tensor,
            )

        result = {"efficiency": output["efficiency"].item()}
        if "discrimination" in output:
            result["discrimination"] = output["discrimination"].item()
        return result

    # ------------------------------------------------------------------
    # Private — model loading
    # ------------------------------------------------------------------

    def _load_model(
        self,
        path: Path,
        use_rnafm: bool,
        use_rlpa: bool,
        multitask: bool,
    ) -> None:
        """Load GUARD-Net from checkpoint."""
        try:
            import torch
            import importlib

            # guard-net/ has a hyphen so can't be imported directly.
            # Register it as 'guard_net' package in sys.modules.
            guard_net_str = str(_GUARD_NET_DIR)
            if "guard_net" not in sys.modules:
                if guard_net_str not in sys.path:
                    sys.path.insert(0, guard_net_str)
                spec = importlib.util.spec_from_file_location(
                    "guard_net",
                    str(_GUARD_NET_DIR / "__init__.py"),
                    submodule_search_locations=[guard_net_str],
                )
                mod = importlib.util.module_from_spec(spec)
                sys.modules["guard_net"] = mod
                spec.loader.exec_module(mod)

            from guard_net import GUARDNet

            self._device = torch.device(self._device_name)

            self.model = GUARDNet(
                use_rnafm=use_rnafm,
                use_rloop_attention=use_rlpa,
                multitask=multitask,
            )

            checkpoint = torch.load(
                str(path), map_location=self._device, weights_only=False,
            )

            if "model_state_dict" in checkpoint:
                state_dict = checkpoint["model_state_dict"]
            else:
                state_dict = checkpoint

            # Handle partial loading: filter out unexpected keys (e.g.
            # domain_head from training) and allow missing keys (e.g.
            # disc_head when loading RLPA checkpoint into multitask model)
            model_keys = set(self.model.state_dict().keys())
            ckpt_keys = set(state_dict.keys())
            missing = model_keys - ckpt_keys
            unexpected = ckpt_keys - model_keys
            if unexpected:
                logger.info(
                    "GUARD-Net: filtering %d unexpected keys from checkpoint: %s",
                    len(unexpected),
                    list(unexpected)[:5],
                )
                state_dict = {k: v for k, v in state_dict.items() if k in model_keys}
            if missing:
                logger.info(
                    "GUARD-Net: %d keys missing from checkpoint (expected for partial load): %s",
                    len(missing),
                    list(missing)[:5],
                )
            self.model.load_state_dict(state_dict, strict=False)

            self.model.to(self._device)
            self.model.eval()

            self._val_rho = checkpoint.get("val_rho") or checkpoint.get("best_val_rho")
            n_params = sum(p.numel() for p in self.model.parameters())

            logger.info(
                "Loaded GUARD-Net from %s (%d params, val_rho=%.4f, rnafm=%s, rlpa=%s, mt=%s)",
                path, n_params, self._val_rho or 0.0,
                use_rnafm, use_rlpa, multitask,
            )
        except Exception as e:
            logger.warning("Failed to load GUARD-Net from %s: %s", path, e)
            self.model = None

    def _load_rnafm_cache(self, cache_dir: Path) -> None:
        """Load RNA-FM embedding cache."""
        try:
            # Import EmbeddingCache from guard-net's data subpackage
            guard_net_str = str(_GUARD_NET_DIR)
            if guard_net_str not in sys.path:
                sys.path.insert(0, guard_net_str)

            # Direct file import to avoid subpackage registration issues
            import importlib.util
            cache_module_path = _GUARD_NET_DIR / "data" / "embedding_cache.py"
            spec = importlib.util.spec_from_file_location(
                "guard_net_embedding_cache", str(cache_module_path),
            )
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            EmbeddingCache = mod.EmbeddingCache

            self._rnafm_cache = EmbeddingCache(str(cache_dir))
            logger.info(
                "Loaded RNA-FM cache from %s (%d sequences)",
                cache_dir, len(self._rnafm_cache),
            )
        except Exception as e:
            logger.warning("Failed to load RNA-FM cache: %s", e)

    def _load_calibration(self, path: Path) -> None:
        """Load temperature and ensemble weight from calibration JSON."""
        if not path.exists():
            logger.info("No GUARD-Net calibration at %s — using raw scores", path)
            return
        try:
            with open(path) as f:
                cal = json.load(f)
            self.temperature = cal.get("temperature", 1.0)
            self.alpha = cal.get("alpha", 0.0)
            self.calibrated = True
            self._calibration_meta = cal
            logger.info(
                "Loaded GUARD-Net calibration: T=%.2f, alpha=%.4f (val ensemble rho=%.4f)",
                self.temperature,
                self.alpha,
                cal.get("val_rho_ensemble", 0.0),
            )
        except Exception as e:
            logger.warning("Failed to load GUARD-Net calibration from %s: %s", path, e)

    # ------------------------------------------------------------------
    # Private — encoding
    # ------------------------------------------------------------------

    def _encode_context(self, candidate: CrRNACandidate) -> np.ndarray:
        """Build the 34-nt context window and one-hot encode it.

        Layout: [PAM 4nt] [spacer 20-23nt] [downstream padding to 34nt]
        Same convention as SequenceMLScorer for consistency.
        """
        window = extract_input_window(
            pam=candidate.pam_seq,
            spacer=candidate.spacer_seq,
            upstream_flank="",
            downstream_flank="",
            total_len=_CONTEXT_LENGTH,
        )
        return one_hot_encode(window, max_len=_CONTEXT_LENGTH)

    def _get_rnafm_embedding(self, candidate: CrRNACandidate) -> Optional[np.ndarray]:
        """Look up RNA-FM embedding for a candidate's crRNA spacer.

        The crRNA spacer is the reverse complement of the protospacer
        (target DNA), with T→U conversion for RNA.

        Returns (20, 640) numpy array or None on cache miss.
        """
        if self._rnafm_cache is None:
            return None

        # crRNA spacer = reverse complement of DNA spacer, T→U
        spacer_dna = candidate.spacer_seq
        crrna_rna = "".join(
            _DNA_TO_RNA_RC.get(b, "N") for b in reversed(spacer_dna.upper())
        )

        emb = self._rnafm_cache.get(crrna_rna)
        if emb is None:
            return None
        return emb.numpy()

    # ------------------------------------------------------------------
    # Private — prediction
    # ------------------------------------------------------------------

    def _predict_single(self, candidate: CrRNACandidate) -> float:
        """Single-sample prediction."""
        context = self._encode_context(candidate)
        rnafm_emb = self._get_rnafm_embedding(candidate)
        predictions = self._predict_batch([context], [rnafm_emb])
        return predictions[0]

    # Alias for pipeline runner compatibility (calls _predict on ml_scorer)
    def _predict(self, candidate: CrRNACandidate) -> float:
        return self._predict_single(candidate)

    def _predict_batch(
        self,
        contexts: list[np.ndarray],
        rnafm_embs: list[Optional[np.ndarray]],
    ) -> list[float]:
        """Batch prediction. Returns list of efficiency scores in [0, 1]."""
        if self.model is None:
            return [0.5] * len(contexts)

        import torch

        # Stack target DNA one-hot tensors
        batch = torch.tensor(
            np.stack(contexts), dtype=torch.float32,
        ).to(self._device)

        # Stack RNA-FM embeddings (use zeros for cache misses)
        rnafm_batch = None
        if self._use_rnafm:
            emb_list = []
            for emb in rnafm_embs:
                if emb is not None:
                    emb_list.append(emb)
                else:
                    # Zero embedding for cache miss — model degrades gracefully
                    emb_list.append(np.zeros((20, 640), dtype=np.float32))
            rnafm_batch = torch.tensor(
                np.stack(emb_list), dtype=torch.float32,
            ).to(self._device)

        with torch.no_grad():
            output = self.model(
                target_onehot=batch,
                crrna_rnafm_emb=rnafm_batch,
            )

        return output["efficiency"].squeeze(-1).clamp(0, 1).tolist()
