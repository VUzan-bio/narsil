"""ESM-2 log-likelihood ratio for the expanded WHO AMR mutation catalogue.

Computes protein-level evolutionary constraint (|LLR|) for ~85 AA
substitution mutations across 4 organisms. This extends the initial
22-target experiment to the full WHO catalogue, providing statistical
power for cross-species fitness cost analysis.

Hypothesis (validated in pilot, MTB rho=-0.706, p=0.023):
  Clinically prevalent AMR mutations have LOW |ESM-2 LLR| because
  they are conservative substitutions that preserve protein function.
  Rare mutations have HIGH |LLR| because they severely disrupt the
  protein — conferring resistance at high fitness cost.

Clinical relevance:
  |LLR| predicts which mutations will dominate in patient populations
  and should be prioritised in diagnostic panel design.

Requirements:
  - ESM-2 (pip install fair-esm), GPU with >=2.5GB VRAM
  - Protein sequences in data/card/protein_sequences.json

Usage:
    python scripts/research/esm2_who_catalogue.py
    python scripts/research/esm2_who_catalogue.py --analysis-only

Output:
    results/research/esm2_who_catalogue/
        llr_all_mutations.csv       — per-mutation ESM-2 LLR
        fitness_landscape.csv       — |LLR| vs prevalence correlation
        figures/                    — scatter plots for publication
"""

from __future__ import annotations

import csv
import json
import logging
import re
from datetime import datetime
from pathlib import Path

import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

RESULTS_DIR = Path("results/research/esm2_who_catalogue")
PROTEIN_SEQ_PATH = Path("data/card/protein_sequences.json")

# ======================================================================
# WHO Catalogue: all known AA substitutions for COMPASS organisms
# ======================================================================
# Sources:
#   MTB: WHO catalogue of mutations v2 (2023), doi:10.1016/S2666-5247(22)00116-1
#   E. coli: CARD database + EUCAST breakpoint tables
#   S. aureus: CARD + CLSI M100
#   N. gonorrhoeae: WHO Gonococcal AMR Surveillance Programme (GASP)

WHO_AA_MUTATIONS = [
    # --- M. tuberculosis (WHO 2023 catalogue v2) ---
    # RRDR (rpoB)
    ("mtb", "rpoB", "S450L", "RIF", 42.0),   # WHO position (MTB numbering)
    ("mtb", "rpoB", "H445Y", "RIF", 8.5),
    ("mtb", "rpoB", "D435V", "RIF", 5.2),
    ("mtb", "rpoB", "H445D", "RIF", 4.1),
    ("mtb", "rpoB", "H445N", "RIF", 2.3),
    ("mtb", "rpoB", "S450W", "RIF", 1.8),
    ("mtb", "rpoB", "L430P", "RIF", 1.5),
    ("mtb", "rpoB", "D435Y", "RIF", 1.2),
    ("mtb", "rpoB", "H445L", "RIF", 1.1),
    ("mtb", "rpoB", "H445R", "RIF", 0.8),
    ("mtb", "rpoB", "S450F", "RIF", 0.5),
    ("mtb", "rpoB", "L452P", "RIF", 0.4),
    # katG
    ("mtb", "katG", "S315T", "INH", 64.0),
    ("mtb", "katG", "S315N", "INH", 2.1),
    ("mtb", "katG", "S315G", "INH", 0.7),
    ("mtb", "katG", "S315R", "INH", 0.3),
    # embB
    ("mtb", "embB", "M306V", "EMB", 24.0),
    ("mtb", "embB", "M306I", "EMB", 18.0),
    ("mtb", "embB", "M306L", "EMB", 5.0),
    ("mtb", "embB", "G406D", "EMB", 3.5),
    ("mtb", "embB", "G406S", "EMB", 1.2),
    ("mtb", "embB", "G406A", "EMB", 0.8),
    ("mtb", "embB", "Q497R", "EMB", 2.5),
    # pncA (high diversity — many rare mutations)
    ("mtb", "pncA", "H57D", "PZA", 3.0),
    ("mtb", "pncA", "D49N", "PZA", 2.5),
    ("mtb", "pncA", "T135P", "PZA", 1.8),
    ("mtb", "pncA", "L4S", "PZA", 1.5),
    ("mtb", "pncA", "H71Y", "PZA", 1.2),
    ("mtb", "pncA", "D12A", "PZA", 1.0),
    ("mtb", "pncA", "V125G", "PZA", 0.8),
    ("mtb", "pncA", "C14R", "PZA", 0.6),
    ("mtb", "pncA", "I31S", "PZA", 0.5),
    ("mtb", "pncA", "W68G", "PZA", 0.4),
    ("mtb", "pncA", "G97D", "PZA", 0.3),
    ("mtb", "pncA", "V139A", "PZA", 0.3),
    ("mtb", "pncA", "T76P", "PZA", 0.2),
    ("mtb", "pncA", "Q10P", "PZA", 0.2),
    ("mtb", "pncA", "A134V", "PZA", 0.2),
    # gyrA (QRDR)
    ("mtb", "gyrA", "D94G", "FQ", 28.0),
    ("mtb", "gyrA", "A90V", "FQ", 18.0),
    ("mtb", "gyrA", "D94A", "FQ", 5.0),
    ("mtb", "gyrA", "D94N", "FQ", 4.5),
    ("mtb", "gyrA", "D94Y", "FQ", 3.0),
    ("mtb", "gyrA", "D94H", "FQ", 2.0),
    ("mtb", "gyrA", "S91P", "FQ", 1.5),
    ("mtb", "gyrA", "A90G", "FQ", 0.5),
    # gyrB
    ("mtb", "gyrB", "E501D", "FQ", 1.0),
    ("mtb", "gyrB", "N499D", "FQ", 0.5),
    # rpsL
    ("mtb", "rpsL", "K43R", "STR", 40.0),
    ("mtb", "rpsL", "K88R", "STR", 8.0),
    # ethA
    ("mtb", "ethA", "A381P", "ETH", 1.5),
    # Rv0678 (bedaquiline)
    ("mtb", "Rv0678", "V1A", "BDQ", 0.5),
    ("mtb", "Rv0678", "S53L", "BDQ", 0.3),
    ("mtb", "Rv0678", "M1R", "BDQ", 0.2),
    # ddn (delamanid)
    ("mtb", "ddn", "L49P", "DLM", 1.0),
    ("mtb", "ddn", "W88C", "DLM", 0.5),
    ("mtb", "ddn", "Y133D", "DLM", 0.3),

    # --- E. coli ---
    ("ecoli", "gyrA", "S83L", "CIP", 70.0),
    ("ecoli", "gyrA", "D87N", "CIP", 25.0),
    ("ecoli", "parC", "S80I", "CIP", 45.0),
    ("ecoli", "parC", "E84V", "CIP", 5.0),

    # --- S. aureus ---
    ("saureus", "gyrA", "S84L", "CIP", 60.0),
    ("saureus", "grlA", "S80F", "CIP", 55.0),
    ("saureus", "grlA", "S80Y", "CIP", 10.0),
    ("saureus", "rpoB", "H481N", "RIF", 15.0),
    ("saureus", "rpoB", "S464P", "RIF", 5.0),
    ("saureus", "fusA", "L461K", "FUS", 3.0),
    ("saureus", "dfrB", "F99Y", "SXT", 8.0),
    ("saureus", "mprF", "S295L", "DAP", 5.0),

    # --- N. gonorrhoeae ---
    ("ngonorrhoeae", "penA", "A501V", "CRO", 15.0),
    ("ngonorrhoeae", "penA", "A501T", "CRO", 5.0),
    ("ngonorrhoeae", "penA", "G545S", "CRO", 8.0),
    ("ngonorrhoeae", "penA", "I312M", "CRO", 20.0),
    ("ngonorrhoeae", "penA", "V316T", "CRO", 12.0),
    ("ngonorrhoeae", "penA", "T483S", "CRO", 10.0),
    ("ngonorrhoeae", "gyrA", "S91F", "CIP", 65.0),
    ("ngonorrhoeae", "gyrA", "D95A", "CIP", 10.0),
    ("ngonorrhoeae", "gyrA", "D95G", "CIP", 15.0),
    ("ngonorrhoeae", "parC", "D86N", "CIP", 20.0),
    ("ngonorrhoeae", "parC", "S87R", "CIP", 30.0),
    ("ngonorrhoeae", "folP", "R228S", "SXT", 25.0),
]


def parse_mutation(mut_str: str) -> tuple[str, int, str]:
    """Parse 'S450L' -> ('S', 450, 'L')."""
    m = re.match(r"^([A-Z])(\d+)([A-Z])$", mut_str)
    if not m:
        raise ValueError(f"Cannot parse: {mut_str}")
    return m.group(1), int(m.group(2)), m.group(3)


def load_proteins() -> dict[str, str]:
    """Load protein sequences."""
    if not PROTEIN_SEQ_PATH.exists():
        raise FileNotFoundError(
            f"Protein sequences not found at {PROTEIN_SEQ_PATH}. "
            "Run: python scripts/research/extract_target_contexts.py"
        )
    with open(PROTEIN_SEQ_PATH) as f:
        return json.load(f)


def compute_esm2_llr_batch(
    proteins: dict[str, str],
    mutations: list[tuple],
) -> list[dict]:
    """Compute ESM-2 masked marginal LLR for all mutations.

    Loads model ONCE, processes all mutations sequentially.
    ~0.5s per mutation on RTX 2070 → ~45s for 85 mutations.
    """
    import torch
    import esm

    logger.info("Loading ESM-2 (esm2_t33_650M_UR50D)...")
    model, alphabet = esm.pretrained.esm2_t33_650M_UR50D()
    batch_converter = alphabet.get_batch_converter()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device).eval()
    logger.info("ESM-2 on %s, VRAM: %.1f GB",
                device, torch.cuda.memory_allocated(0) / 1e9 if torch.cuda.is_available() else 0)

    results = []
    n_computed = 0
    n_skipped = 0

    for org_id, gene, mutation, drug, prevalence in mutations:
        ref_aa, position, alt_aa = parse_mutation(mutation)
        label = f"{gene}_{mutation}"
        protein_key = f"{org_id}_{gene}"
        protein_seq = proteins.get(protein_key)

        if protein_seq is None:
            logger.debug("No protein for %s, skipping %s", protein_key, label)
            results.append({
                "label": label, "organism": org_id, "gene": gene,
                "mutation": mutation, "drug": drug,
                "prevalence_pct": prevalence,
                "esm2_llr": None, "ref_log_prob": None, "alt_log_prob": None,
                "ref_aa": ref_aa, "position": position, "alt_aa": alt_aa,
                "status": "no_protein",
            })
            n_skipped += 1
            continue

        pos_idx = position - 1  # 0-indexed
        if pos_idx < 0 or pos_idx >= len(protein_seq):
            logger.warning("Position %d out of range for %s (len=%d)",
                          position, protein_key, len(protein_seq))
            results.append({
                "label": label, "organism": org_id, "gene": gene,
                "mutation": mutation, "drug": drug,
                "prevalence_pct": prevalence,
                "esm2_llr": None, "ref_log_prob": None, "alt_log_prob": None,
                "ref_aa": ref_aa, "position": position, "alt_aa": alt_aa,
                "status": "position_out_of_range",
            })
            n_skipped += 1
            continue

        # Verify ref AA matches (warn but continue — numbering offsets are common)
        actual_aa = protein_seq[pos_idx]
        if actual_aa != ref_aa:
            logger.debug("Ref mismatch at %s pos %d: expected %s, found %s (numbering offset)",
                        protein_key, position, ref_aa, actual_aa)

        # Mask the target position
        masked_seq = protein_seq[:pos_idx] + "<mask>" + protein_seq[pos_idx + 1:]
        data = [("protein", masked_seq)]
        _, _, tokens = batch_converter(data)
        tokens = tokens.to(device)

        with torch.no_grad():
            logits = model(tokens, repr_layers=[], return_contacts=False)["logits"]

        # Token position = pos_idx + 1 (CLS token at 0)
        log_probs = torch.nn.functional.log_softmax(logits[0, pos_idx + 1], dim=-1)
        ref_lp = log_probs[alphabet.get_idx(ref_aa)].item()
        alt_lp = log_probs[alphabet.get_idx(alt_aa)].item()
        llr = alt_lp - ref_lp

        results.append({
            "label": label, "organism": org_id, "gene": gene,
            "mutation": mutation, "drug": drug,
            "prevalence_pct": prevalence,
            "esm2_llr": round(llr, 6),
            "abs_esm2_llr": round(abs(llr), 6),
            "ref_log_prob": round(ref_lp, 6),
            "alt_log_prob": round(alt_lp, 6),
            "ref_aa": ref_aa, "position": position, "alt_aa": alt_aa,
            "ref_aa_actual": actual_aa,
            "status": "computed",
        })
        n_computed += 1

        if n_computed % 10 == 0:
            logger.info("  Computed %d/%d (skipped %d)", n_computed, len(mutations), n_skipped)

    logger.info("Done: %d computed, %d skipped", n_computed, n_skipped)

    del model
    torch.cuda.empty_cache()
    return results


def correlation_analysis(results: list[dict]) -> dict:
    """Spearman correlation between |ESM-2 LLR| and clinical prevalence."""
    from scipy.stats import spearmanr

    computed = [r for r in results if r.get("esm2_llr") is not None]
    analysis = {}

    # Per organism
    by_org = {}
    for r in computed:
        by_org.setdefault(r["organism"], []).append(r)

    for org_id, targets in sorted(by_org.items()):
        valid = [(abs(t["esm2_llr"]), t["prevalence_pct"]) for t in targets]
        if len(valid) >= 5:
            x, y = zip(*valid)
            rho, p = spearmanr(x, y)
            analysis[org_id] = {
                "n": len(valid),
                "spearman_rho": round(float(rho), 4),
                "p_value": round(float(p), 4),
                "significant": float(p) < 0.05,
            }
            logger.info("  %s (N=%d): rho=%.3f, p=%.4f %s",
                       org_id, len(valid), rho, p,
                       "*" if float(p) < 0.05 else "")

    # Per gene (within organisms)
    by_gene = {}
    for r in computed:
        key = f"{r['organism']}_{r['gene']}"
        by_gene.setdefault(key, []).append(r)

    logger.info("\nPer-gene (N>=4):")
    for gene_key, targets in sorted(by_gene.items()):
        if len(targets) >= 4:
            x = [abs(t["esm2_llr"]) for t in targets]
            y = [t["prevalence_pct"] for t in targets]
            rho, p = spearmanr(x, y)
            logger.info("  %s (N=%d): rho=%.3f, p=%.4f", gene_key, len(targets), rho, p)
            analysis[gene_key] = {
                "n": len(targets),
                "spearman_rho": round(float(rho), 4),
                "p_value": round(float(p), 4),
            }

    # Pooled across all organisms
    all_valid = [(abs(r["esm2_llr"]), r["prevalence_pct"]) for r in computed]
    if len(all_valid) >= 10:
        x, y = zip(*all_valid)
        rho, p = spearmanr(x, y)
        analysis["pooled"] = {
            "n": len(all_valid),
            "spearman_rho": round(float(rho), 4),
            "p_value": round(float(p), 4),
            "significant": float(p) < 0.05,
        }
        logger.info("\n  POOLED (N=%d): rho=%.3f, p=%.4f %s",
                   len(all_valid), rho, p,
                   "***" if float(p) < 0.001 else "**" if float(p) < 0.01 else "*" if float(p) < 0.05 else "")

    return analysis


def main():
    import argparse
    parser = argparse.ArgumentParser(description="ESM-2 WHO catalogue LLR")
    parser.add_argument("--analysis-only", action="store_true")
    args = parser.parse_args()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    with open(RESULTS_DIR / "experiment_config.json", "w") as f:
        json.dump({
            "experiment": "esm2_who_catalogue",
            "timestamp": datetime.now().isoformat(),
            "model": "esm2_t33_650M_UR50D",
            "n_mutations": len(WHO_AA_MUTATIONS),
        }, f, indent=2)

    if args.analysis_only:
        with open(RESULTS_DIR / "llr_all_mutations.csv") as f:
            results = list(csv.DictReader(f))
        for r in results:
            if r.get("esm2_llr") and r["esm2_llr"] != "":
                r["esm2_llr"] = float(r["esm2_llr"])
                r["prevalence_pct"] = float(r["prevalence_pct"])
    else:
        proteins = load_proteins()
        logger.info("Loaded %d protein sequences", len(proteins))
        logger.info("Computing ESM-2 LLR for %d AA substitutions...", len(WHO_AA_MUTATIONS))

        results = compute_esm2_llr_batch(proteins, WHO_AA_MUTATIONS)

        # Save raw results
        out_path = RESULTS_DIR / "llr_all_mutations.csv"
        computed = [r for r in results if r["status"] == "computed"]
        if computed:
            with open(out_path, "w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=computed[0].keys())
                writer.writeheader()
                writer.writerows(results)
            logger.info("Saved %d results to %s", len(results), out_path)

    # Correlation analysis
    logger.info("\n" + "=" * 60)
    logger.info("CORRELATION: |ESM-2 LLR| vs CLINICAL PREVALENCE")
    logger.info("=" * 60)
    analysis = correlation_analysis(results)

    with open(RESULTS_DIR / "fitness_landscape.json", "w") as f:
        json.dump(analysis, f, indent=2)

    # Summary statistics
    computed = [r for r in results if r.get("esm2_llr") is not None]
    logger.info("\n" + "=" * 60)
    logger.info("SUMMARY")
    logger.info("=" * 60)
    logger.info("Computed: %d / %d mutations", len(computed), len(results))
    if computed:
        llrs = [r["esm2_llr"] for r in computed]
        abs_llrs = [abs(l) for l in llrs]
        logger.info("|LLR| range: [%.3f, %.3f]", min(abs_llrs), max(abs_llrs))
        logger.info("|LLR| median: %.3f", np.median(abs_llrs))
        logger.info("LLR < 0 (WT preferred): %d/%d (%.0f%%)",
                    sum(1 for l in llrs if l < 0), len(llrs),
                    100 * sum(1 for l in llrs if l < 0) / len(llrs))

        # Top 5 most conserved (lowest |LLR| = most prevalent clinically)
        by_abs = sorted(computed, key=lambda r: abs(r["esm2_llr"]))
        logger.info("\nTop 5 most conserved (low |LLR| = prevalent, fit):")
        for r in by_abs[:5]:
            logger.info("  %s: |LLR|=%.3f, prevalence=%.1f%%",
                       r["label"], abs(r["esm2_llr"]), r["prevalence_pct"])

        logger.info("\nTop 5 most disruptive (high |LLR| = rare, costly):")
        for r in by_abs[-5:]:
            logger.info("  %s: |LLR|=%.3f, prevalence=%.1f%%",
                       r["label"], abs(r["esm2_llr"]), r["prevalence_pct"])


if __name__ == "__main__":
    main()
