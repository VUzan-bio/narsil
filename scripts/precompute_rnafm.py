#!/usr/bin/env python3
"""Pre-compute RNA-FM embeddings for all WHO mutation spacers at Docker build time.

This eliminates the ~10-26 min RNA-FM inference bottleneck at pipeline runtime.
Embeddings are stored in the EmbeddingCache format and loaded automatically
by CompassMLScorer when the cache directory is non-empty.

Usage (called by Dockerfile):
    python scripts/precompute_rnafm.py

Output:
    compass/data/embeddings/rnafm/batch_0.pt  (embeddings)
    compass/data/embeddings/rnafm/index.pt    (hash index)
"""

import sys
import logging
from pathlib import Path

import numpy as np
import torch

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# DNA -> RNA reverse complement (spacer DNA to crRNA RNA)
_DNA_TO_RNA_RC = {"A": "U", "T": "A", "C": "G", "G": "C"}

CACHE_DIR = Path("compass/data/embeddings/rnafm")


def spacer_to_rna(spacer_dna: str) -> str:
    """Convert spacer DNA to crRNA RNA sequence."""
    return "".join(_DNA_TO_RNA_RC.get(b, "N") for b in reversed(spacer_dna.upper()))


def collect_all_spacers() -> list[str]:
    """Collect all unique spacer sequences from the pipeline.

    Runs M1-M3 (target resolution, PAM scanning, candidate filtering)
    to get all filtered candidates and their spacer sequences.
    """
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

    from compass.core.types import Organism, CasVariant
    from compass.targets.resolver import TargetResolver
    from compass.candidates.scanner import PAMScanner
    from compass.candidates.filters import CandidateFilter

    # Default WHO MTB panel mutations
    from compass.pipeline.runner import COMPASSPipeline

    logger.info("Loading genome and annotations...")
    resolver = TargetResolver(
        genome_fasta="data/references/H37Rv.fasta",
        gff_path="data/references/H37Rv.gff3",
    )

    # Default enAsCas12a config
    cas = CasVariant.enAsCas12a
    scanner = PAMScanner(cas_variant=cas, proximity_scan=True, max_proximity_distance=200)
    candidate_filter = CandidateFilter(organism=Organism.MTB, cas_variant=cas)

    # Default WHO panel targets
    default_targets = [
        "rpoB_S531L", "rpoB_H526Y", "rpoB_D516V",
        "katG_S315T", "fabG1_C-15T",
        "embB_M306V", "embB_M306I",
        "pncA_H57D",
        "gyrA_D94G", "gyrA_A90V",
        "rrs_A1401G", "eis_C-14T",
    ]

    logger.info("Resolving %d targets...", len(default_targets))
    targets = resolver.resolve_targets(default_targets)

    all_spacers = set()
    for target in targets:
        logger.info("Scanning %s...", target.label)
        candidates = scanner.scan(target)
        filtered = candidate_filter.filter(candidates, target)
        for c in filtered:
            all_spacers.add(c.spacer_seq)
        # Also include unfiltered direct candidates (for Top-K alternatives)
        for c in candidates:
            all_spacers.add(c.spacer_seq)

    logger.info("Collected %d unique spacer sequences", len(all_spacers))
    return list(all_spacers)


def compute_embeddings(spacers: list[str]) -> None:
    """Compute RNA-FM embeddings and save to cache."""
    # Convert spacers to RNA
    rna_seqs = list(set(spacer_to_rna(s) for s in spacers))
    logger.info("Computing RNA-FM embeddings for %d unique RNA sequences...", len(rna_seqs))

    # Load RNA-FM
    import fm
    model, alphabet = fm.pretrained.rna_fm_t12()
    model.eval()
    bc = alphabet.get_batch_converter()

    # Import EmbeddingCache
    cache_module_path = Path("compass-net/data/embedding_cache.py")
    import importlib.util
    spec = importlib.util.spec_from_file_location("embedding_cache", str(cache_module_path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    EmbeddingCache = mod.EmbeddingCache

    cache = EmbeddingCache(str(CACHE_DIR))

    # Process in chunks
    CHUNK = 64
    all_seqs = []
    all_embs = []

    for start in range(0, len(rna_seqs), CHUNK):
        chunk = rna_seqs[start:start + CHUNK]
        batch_data = [(f"s{i}", seq) for i, seq in enumerate(chunk)]
        _, _, tokens = bc(batch_data)

        with torch.no_grad():
            out = model(tokens, repr_layers=[12])

        reps = out["representations"][12][:, 1:-1, :].cpu()

        for j, seq in enumerate(chunk):
            raw = reps[j].float()
            emb_20 = torch.zeros(20, 640)
            n = min(raw.shape[0], 20)
            emb_20[:n] = raw[:n]
            all_seqs.append(seq)
            all_embs.append(emb_20)

        logger.info("  Processed %d/%d sequences", min(start + CHUNK, len(rna_seqs)), len(rna_seqs))

    # Save to cache
    cache.put_batch(all_seqs, all_embs)
    logger.info("Saved %d embeddings to %s", len(all_seqs), CACHE_DIR)
    logger.info("Cache size: %d entries", len(cache))


def main():
    logger.info("=== Pre-computing RNA-FM embeddings for COMPASS panel ===")

    # Download RNA-FM weights first (run as subprocess since it uses exit())
    import subprocess
    logger.info("Downloading RNA-FM weights...")
    subprocess.run([sys.executable, "scripts/download_rnafm.py"], check=False)

    spacers = collect_all_spacers()
    compute_embeddings(spacers)

    logger.info("=== Done! RNA-FM cache ready at %s ===", CACHE_DIR)


if __name__ == "__main__":
    main()
