"""Per-position thermodynamic profiles for crRNA:target hybrids.

Computes cumulative free energy along the R-loop, using RNA:DNA
nearest-neighbor parameters (Sugimoto et al., Biochemistry 1995).
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

# Import NN parameters from guard-net thermodynamic module
_GUARD_NET_DIR = Path(__file__).resolve().parent.parent.parent / "guard-net"
if str(_GUARD_NET_DIR) not in sys.path:
    sys.path.insert(0, str(_GUARD_NET_DIR))

try:
    from features.thermodynamic import (
        RNA_DNA_NN, INIT_DH, INIT_DS,
        compute_spacer_folding_dg, compute_hybrid_dg, compute_melting_temperature,
    )
except ImportError:
    # Fallback inline parameters
    RNA_DNA_NN = {
        "AA": (-7.8, -21.9), "AC": (-5.9, -12.3),
        "AG": (-9.1, -23.5), "AU": (-8.3, -23.9),
        "CA": (-9.0, -26.1), "CC": (-9.3, -23.2),
        "CG": (-16.3, -47.1), "CU": (-7.0, -19.7),
        "GA": (-5.5, -13.5), "GC": (-8.0, -17.1),
        "GG": (-12.8, -31.9), "GU": (-7.8, -21.6),
        "UA": (-7.8, -23.2), "UC": (-8.6, -22.9),
        "UG": (-10.4, -28.4), "UU": (-11.5, -36.4),
    }
    INIT_DH = 1.9
    INIT_DS = -3.9

    def compute_spacer_folding_dg(seq):
        gc = sum(1 for b in seq.upper() if b in "GC") / max(len(seq), 1)
        return -2.0 * gc

    def compute_hybrid_dg(seq, temperature_celsius=37.0, na_concentration=0.15):
        T = temperature_celsius + 273.15
        dH, dS = INIT_DH, INIT_DS
        s = seq.upper()
        for i in range(len(s) - 1):
            d = s[i:i+2]
            if d in RNA_DNA_NN:
                h, ss = RNA_DNA_NN[d]
                dH += h
                dS += ss
        dS += 0.368 * len(s) * math.log(na_concentration)
        return dH - T * (dS / 1000.0)

    def compute_melting_temperature(seq, na_concentration=0.15, oligo_concentration=250e-9):
        R = 1.987
        dH, dS = INIT_DH, INIT_DS
        s = seq.upper()
        for i in range(len(s) - 1):
            d = s[i:i+2]
            if d in RNA_DNA_NN:
                h, ss = RNA_DNA_NN[d]
                dH += h
                dS += ss
        dS += 0.368 * len(s) * math.log(na_concentration)
        dS_total = dS + R * math.log(oligo_concentration / 4.0)
        if dS_total == 0:
            return 0.0
        return (dH * 1000.0) / dS_total - 273.15


_DNA_TO_RNA_RC = {"A": "U", "T": "A", "C": "G", "G": "C", "N": "N"}
_RNA_COMPLEMENT = {"A": "U", "U": "A", "C": "G", "G": "C", "N": "N"}

# Mismatch penalty: average destabilisation for a single RNA:DNA mismatch
_MISMATCH_PENALTY = 2.0  # kcal/mol


def _dna_to_crrna(spacer_dna: str) -> str:
    """Convert DNA spacer to crRNA (reverse complement, T->U)."""
    return "".join(_DNA_TO_RNA_RC.get(b, "N") for b in reversed(spacer_dna.upper()))


def compute_cumulative_dg_profile(
    rna_spacer: str,
    temperature_celsius: float = 37.0,
) -> list[float]:
    """Cumulative dG at each position of the RNA:DNA hybrid.

    Position 1 = PAM-proximal (seed start).
    Returns list of len(rna_spacer) floats.
    """
    T = temperature_celsius + 273.15
    seq = rna_spacer.upper()
    cumulative = [0.0]
    running = 0.0

    for i in range(len(seq) - 1):
        dinuc = seq[i:i + 2]
        if dinuc in RNA_DNA_NN:
            dH, dS = RNA_DNA_NN[dinuc]
            step_dg = dH - T * (dS / 1000.0)
        else:
            step_dg = -1.0
        running += step_dg
        cumulative.append(round(running, 2))

    return cumulative


def compute_per_position_dg(rna_spacer: str, temperature_celsius: float = 37.0) -> list[float]:
    """Per-position dG contribution (not cumulative)."""
    T = temperature_celsius + 273.15
    seq = rna_spacer.upper()
    per_pos = [0.0]

    for i in range(len(seq) - 1):
        dinuc = seq[i:i + 2]
        if dinuc in RNA_DNA_NN:
            dH, dS = RNA_DNA_NN[dinuc]
            step_dg = dH - T * (dS / 1000.0)
        else:
            step_dg = -1.0
        per_pos.append(round(step_dg, 2))

    return per_pos


def compute_wt_profile(
    rna_spacer: str,
    snp_position: int,
    temperature_celsius: float = 37.0,
) -> list[float]:
    """Cumulative dG profile for the wildtype target (mismatch at SNP).

    At snp_position, the RNA:DNA pair is mismatched — adds a penalty
    relative to the perfect-match profile. All downstream positions
    shift by this penalty (cumulative).
    """
    profile = compute_cumulative_dg_profile(rna_spacer, temperature_celsius)
    if 0 < snp_position < len(profile):
        for i in range(snp_position, len(profile)):
            profile[i] = round(profile[i] + _MISMATCH_PENALTY, 2)
    return profile


def compute_target_opening_dg(target_dna_20: str) -> float:
    """Cost to denature the 20-bp dsDNA target region.

    Uses simplified nearest-neighbor for DNA/DNA (SantaLucia 1998).
    More positive = harder to open = higher GC.
    """
    DNA_DNA_NN = {
        "AA": (-7.9, -22.2), "AT": (-7.2, -20.4),
        "AG": (-7.8, -21.0), "AC": (-8.4, -22.4),
        "TA": (-7.2, -21.3), "TT": (-7.9, -22.2),
        "TG": (-8.5, -22.7), "TC": (-8.2, -22.2),
        "GA": (-8.2, -22.2), "GT": (-8.4, -22.4),
        "GG": (-8.0, -19.9), "GC": (-10.6, -27.2),
        "CA": (-8.5, -22.7), "CT": (-7.8, -21.0),
        "CG": (-10.6, -27.2), "CC": (-8.0, -19.9),
    }
    T = 310.15  # 37 C
    dH = 0.1  # initiation
    dS = -2.8
    seq = target_dna_20.upper()
    for i in range(len(seq) - 1):
        dinuc = seq[i:i + 2]
        if dinuc in DNA_DNA_NN:
            h, s = DNA_DNA_NN[dinuc]
            dH += h
            dS += s
    duplex_dg = dH - T * (dS / 1000.0)
    return round(-duplex_dg, 2)  # opening cost = -duplex stability


def get_thermo_profile(
    spacer_dna: str,
    pam_seq: str,
    snp_position: int | None = None,
) -> dict:
    """Full thermodynamic profile for a candidate.

    Args:
        spacer_dna: 18-23 nt DNA spacer sequence
        pam_seq: 4 nt PAM sequence
        snp_position: 1-indexed position of SNP in spacer (None for proximity)

    Returns dict with all profile data for the frontend.
    """
    crrna = _dna_to_crrna(spacer_dna)
    positions = list(range(1, len(crrna) + 1))

    mut_cumulative = compute_cumulative_dg_profile(crrna)
    mut_per_pos = compute_per_position_dg(crrna)

    wt_cumulative = None
    if snp_position and 0 < snp_position <= len(crrna):
        wt_cumulative = compute_wt_profile(crrna, snp_position)

    # Scalar features
    protospacer_20 = spacer_dna[:20] if len(spacer_dna) >= 20 else spacer_dna
    folding_dg = compute_spacer_folding_dg(crrna)
    hybrid_dg = compute_hybrid_dg(crrna)
    melting_tm = compute_melting_temperature(crrna)
    target_opening = compute_target_opening_dg(protospacer_20)

    # Seed dG (positions 1-8)
    seed_len = min(8, len(mut_cumulative) - 1)
    seed_dg = mut_cumulative[seed_len] if seed_len > 0 else 0.0

    result = {
        "spacer_dna": spacer_dna,
        "pam_seq": pam_seq,
        "crrna_spacer": crrna,
        "snp_position": snp_position,
        "mutant_profile": {
            "positions": positions,
            "dg_cumulative": mut_cumulative,
            "dg_per_position": mut_per_pos,
        },
        "scalars": {
            "folding_dg": round(folding_dg, 2),
            "hybrid_dg": round(hybrid_dg, 2),
            "target_opening_dg": target_opening,
            "melting_tm": round(melting_tm, 1),
            "seed_dg": round(seed_dg, 2),
        },
    }

    if wt_cumulative is not None:
        result["wildtype_profile"] = {
            "positions": positions,
            "dg_cumulative": wt_cumulative,
            "dg_per_position": compute_per_position_dg(crrna),
        }

    return result
