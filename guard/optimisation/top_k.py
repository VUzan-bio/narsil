"""Top-K alternative candidates per target with tradeoff annotations.

After the multiplex optimizer selects one candidate per target, this module
collects the next-best alternatives and annotates each with the tradeoff
it represents relative to the selected candidate:

- "higher_efficiency": better predicted activity, worse discrimination
- "higher_discrimination": better MUT/WT ratio, lower activity
- "fewer_offtargets": cleaner off-target profile, some other metric worse
- "different_pam": targets a different PAM site (structural diversity)

This gives clinicians visibility into what they're giving up with the
current selection, and allows interactive exploration of alternatives
in the UI.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from guard.core.types import ScoredCandidate, PanelMember

logger = logging.getLogger(__name__)


@dataclass
class AlternativeCandidate:
    """An alternative candidate with tradeoff annotation."""
    candidate: ScoredCandidate
    rank: int
    tradeoffs: list[str]    # e.g. ["higher_discrimination", "fewer_offtargets"]
    delta_efficiency: float  # vs selected candidate
    delta_discrimination: float  # vs selected candidate

    def to_dict(self) -> dict:
        return {
            "spacer_seq": self.candidate.candidate.spacer_seq,
            "rank": self.rank,
            "efficiency": self.candidate.composite_score,
            "discrimination_ratio": (
                self.candidate.discrimination.ratio
                if self.candidate.discrimination else None
            ),
            "offtarget_count": self.candidate.offtarget.total_risky_hits,
            "tradeoffs": self.tradeoffs,
            "delta_efficiency": round(self.delta_efficiency, 4),
            "delta_discrimination": round(self.delta_discrimination, 4),
        }


@dataclass
class TargetCandidateSet:
    """Selected candidate + ranked alternatives for one target."""
    target_label: str
    selected: ScoredCandidate
    alternatives: list[AlternativeCandidate]

    def to_dict(self) -> dict:
        return {
            "target_label": self.target_label,
            "selected_spacer": self.selected.candidate.spacer_seq,
            "selected_efficiency": self.selected.composite_score,
            "selected_discrimination": (
                self.selected.discrimination.ratio
                if self.selected.discrimination else None
            ),
            "n_alternatives": len(self.alternatives),
            "alternatives": [a.to_dict() for a in self.alternatives],
        }


def _annotate_tradeoffs(
    selected: ScoredCandidate,
    alternative: ScoredCandidate,
) -> list[str]:
    """Determine what tradeoffs an alternative represents vs the selected."""
    tradeoffs: list[str] = []

    sel_eff = selected.composite_score
    alt_eff = alternative.composite_score
    sel_disc = selected.discrimination.ratio if selected.discrimination else 0.0
    alt_disc = alternative.discrimination.ratio if alternative.discrimination else 0.0
    sel_ot = selected.offtarget.total_risky_hits
    alt_ot = alternative.offtarget.total_risky_hits

    # Higher efficiency
    if alt_eff > sel_eff + 0.02:
        tradeoffs.append("higher_efficiency")

    # Higher discrimination
    if alt_disc > sel_disc * 1.2 and alt_disc > sel_disc + 0.5:
        tradeoffs.append("higher_discrimination")

    # Fewer off-targets
    if alt_ot < sel_ot:
        tradeoffs.append("fewer_offtargets")

    # Different PAM (structural diversity)
    sel_pam_pos = selected.candidate.genomic_start
    alt_pam_pos = alternative.candidate.genomic_start
    if abs(sel_pam_pos - alt_pam_pos) > 5:
        tradeoffs.append("different_pam")

    # If no specific tradeoff identified, it's a general alternative
    if not tradeoffs:
        tradeoffs.append("comparable")

    return tradeoffs


def collect_top_k(
    members: list[PanelMember],
    candidates_by_target: dict[str, list[ScoredCandidate]],
    k: int = 5,
) -> list[TargetCandidateSet]:
    """Collect top-K alternative candidates per target with tradeoff annotations.

    Args:
        members: Panel members with selected candidates.
        candidates_by_target: All scored candidates per target label.
        k: Maximum number of alternatives to return per target (3-5 typical).

    Returns:
        List of TargetCandidateSet, one per panel member.
    """
    results: list[TargetCandidateSet] = []

    for member in members:
        selected = member.selected_candidate
        label = member.label
        all_candidates = candidates_by_target.get(label, [])

        # Sort by composite score (descending)
        ranked = sorted(
            all_candidates,
            key=lambda sc: sc.composite_score,
            reverse=True,
        )

        # Collect alternatives (exclude the selected one)
        alternatives: list[AlternativeCandidate] = []
        rank = 0
        for sc in ranked:
            if sc.candidate.spacer_seq == selected.candidate.spacer_seq:
                continue
            rank += 1

            sel_disc = selected.discrimination.ratio if selected.discrimination else 0.0
            alt_disc = sc.discrimination.ratio if sc.discrimination else 0.0

            alt = AlternativeCandidate(
                candidate=sc,
                rank=rank,
                tradeoffs=_annotate_tradeoffs(selected, sc),
                delta_efficiency=sc.composite_score - selected.composite_score,
                delta_discrimination=alt_disc - sel_disc,
            )
            alternatives.append(alt)

            if len(alternatives) >= k:
                break

        results.append(TargetCandidateSet(
            target_label=label,
            selected=selected,
            alternatives=alternatives,
        ))

    logger.info(
        "Collected top-%d alternatives for %d targets (avg %.1f alternatives/target)",
        k, len(results),
        sum(len(r.alternatives) for r in results) / max(len(results), 1),
    )

    return results
