"""Standard RPA primer design for DIRECT detection candidates.

For DIRECT detection candidates the crRNA spacer overlaps the mutation site,
so discrimination comes from Cas12a mismatch intolerance — not from primers.
Primers simply need to amplify an 80–250 bp region that contains the crRNA
binding site.

Design rules:
  - Primer length 25–38 nt (widened for M.tb 65.6% GC genome)
  - Tm 57–72°C (RPA uses recombinase at 37°C, tolerant of Tm variation)
  - Amplicon 80–250 bp containing the full crRNA target site
  - Spacer binding site ≥15 bp from each primer 3' end
  - Both primers are standard/symmetrical — no allele-specificity needed

References:
  - Piepenburg et al., PLoS Biol 2006 (RPA mechanism)
  - Li et al., Cell Rep Med 2022 (RPA-CRISPR design rules)
"""

from __future__ import annotations

import logging
from typing import Optional

from Bio.SeqUtils import MeltingTemp as mt
from Bio.Seq import Seq

from guard.core.constants import (
    RPA_AMPLICON_MAX,
    RPA_AMPLICON_MIN,
    RPA_PRIMER_LENGTH_MAX,
    RPA_PRIMER_LENGTH_MIN,
    RPA_TM_MAX,
    RPA_TM_MIN,
)
from guard.core.types import (
    CrRNACandidate,
    DetectionStrategy,
    RPAPrimer,
    RPAPrimerPair,
    Target,
)

logger = logging.getLogger(__name__)

_VALID_BASES = {"A", "T", "G", "C"}


class StandardRPADesigner:
    """Design flanking RPA primers for DIRECT detection candidates."""

    def __init__(
        self,
        primer_len_min: int = RPA_PRIMER_LENGTH_MIN,
        primer_len_max: int = RPA_PRIMER_LENGTH_MAX,
        tm_min: float = RPA_TM_MIN,
        tm_max: float = RPA_TM_MAX,
        amplicon_min: int = RPA_AMPLICON_MIN,
        amplicon_max: int = RPA_AMPLICON_MAX,
        spacer_min_gap: int = 15,
    ) -> None:
        self.primer_len_min = primer_len_min
        self.primer_len_max = primer_len_max
        self.tm_min = tm_min
        self.tm_max = tm_max
        self.amplicon_min = amplicon_min
        self.amplicon_max = amplicon_max
        self.spacer_min_gap = spacer_min_gap

    def design(
        self,
        candidate: CrRNACandidate,
        target: Target,
        genome_seq: str,
    ) -> list[RPAPrimerPair]:
        """Design standard flanking RPA primer pairs for a DIRECT candidate.

        Args:
            candidate: DIRECT crRNA candidate with genomic coordinates.
            target: Resolved target (unused for DIRECT — primers anchor on crRNA).
            genome_seq: Full genome sequence string.

        Returns:
            Ranked list of RPAPrimerPair (max 10).
        """
        if candidate.detection_strategy != DetectionStrategy.DIRECT:
            logger.debug(
                "Skipping standard RPA for non-direct candidate %s",
                candidate.candidate_id,
            )
            return []

        crrna_start = candidate.genomic_start
        crrna_end = candidate.genomic_end

        # Design forward primers upstream of crRNA
        fwd_primers = self._design_flanking_primer(
            genome_seq,
            anchor_pos=crrna_start - self.spacer_min_gap,
            direction="fwd",
        )

        # Design reverse primers downstream of crRNA
        rev_primers = self._design_flanking_primer(
            genome_seq,
            anchor_pos=crrna_end + self.spacer_min_gap,
            direction="rev",
        )

        if not fwd_primers or not rev_primers:
            logger.debug(
                "No flanking primers for %s (fwd=%d, rev=%d)",
                candidate.candidate_id,
                len(fwd_primers),
                len(rev_primers),
            )
            return []

        # Pair and filter
        pairs: list[RPAPrimerPair] = []
        for fwd in fwd_primers:
            for rev in rev_primers:
                amp_start = fwd.amplicon_start
                amp_end = rev.amplicon_end
                amp_len = amp_end - amp_start

                # Amplicon length check
                if amp_len < self.amplicon_min or amp_len > self.amplicon_max:
                    continue

                # crRNA must be entirely within amplicon
                if crrna_start < amp_start or crrna_end > amp_end:
                    continue

                pairs.append(RPAPrimerPair(
                    fwd=fwd,
                    rev=rev,
                    detection_strategy=DetectionStrategy.DIRECT,
                ))

        # Rank by score
        pairs.sort(key=self._pair_score, reverse=True)
        return pairs[:10]

    def _design_flanking_primer(
        self,
        genome: str,
        anchor_pos: int,
        direction: str,
        min_dist: int = 10,
        max_dist: int = 150,
    ) -> list[RPAPrimer]:
        """Design standard flanking primers in one direction."""
        primers: list[RPAPrimer] = []
        glen = len(genome)

        if direction == "fwd":
            for offset in range(min_dist, max_dist):
                start = anchor_pos - offset
                for length in range(self.primer_len_min, self.primer_len_max + 1):
                    end = start + length
                    if start < 0 or end > glen:
                        continue
                    seq = genome[start:end].upper()
                    if not set(seq).issubset(_VALID_BASES):
                        continue
                    try:
                        tm = float(mt.Tm_NN(Seq(seq), nn_table=mt.DNA_NN3))
                    except Exception:
                        continue
                    if self.tm_min <= tm <= self.tm_max:
                        primers.append(RPAPrimer(
                            seq=seq,
                            tm=tm,
                            direction="fwd",
                            amplicon_start=start,
                            amplicon_end=start + self.amplicon_max,
                        ))
                        break  # one per offset
        else:
            for offset in range(min_dist, max_dist):
                end = anchor_pos + offset
                for length in range(self.primer_len_min, self.primer_len_max + 1):
                    start = end - length
                    if start < 0 or end > glen:
                        continue
                    seq = str(Seq(genome[start:end].upper()).reverse_complement())
                    if not set(seq).issubset(_VALID_BASES):
                        continue
                    try:
                        tm = float(mt.Tm_NN(Seq(seq), nn_table=mt.DNA_NN3))
                    except Exception:
                        continue
                    if self.tm_min <= tm <= self.tm_max:
                        primers.append(RPAPrimer(
                            seq=seq,
                            tm=tm,
                            direction="rev",
                            amplicon_start=end - self.amplicon_max,
                            amplicon_end=end,
                        ))
                        break  # one per offset

        return primers[:20]

    @staticmethod
    def _pair_score(pair: RPAPrimerPair) -> float:
        """Score a standard RPA pair. Higher = better."""
        tm_opt = 64.5  # Optimal for M.tb (65.6% GC)
        fwd_tm = 1.0 - abs(pair.fwd.tm - tm_opt) / 8.0
        rev_tm = 1.0 - abs(pair.rev.tm - tm_opt) / 8.0
        amp = 1.0 - (pair.amplicon_length - RPA_AMPLICON_MIN) / (
            RPA_AMPLICON_MAX - RPA_AMPLICON_MIN
        )
        return fwd_tm + rev_tm + amp
