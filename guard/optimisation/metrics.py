"""Diagnostic performance metrics for CRISPR panel evaluation.

Sensitivity and specificity are computed at the PANEL level, not per-target.
A panel "detects" a mutation if there exists at least one crRNA in the panel
that both:
  1. Has predicted efficiency >= the efficiency threshold
  2. Has predicted discrimination ratio >= the discrimination threshold

Sensitivity = fraction of mutations detected by the panel
Specificity = related to discrimination — high disc ratio means the panel
              correctly distinguishes mutant from wildtype.

Coverage = fraction of input targets for which at least one candidate
           passes all thresholds (efficiency, discrimination, off-target).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from guard.core.types import ScoredCandidate, PanelMember


@dataclass
class DiagnosticMetrics:
    """Panel-level diagnostic performance metrics.

    Computed from a set of panel members and their candidates against
    specified thresholds.
    """

    # Inputs
    total_targets: int = 0
    covered_targets: int = 0       # targets with >= 1 passing candidate
    detected_targets: int = 0      # targets with selected candidate passing both thresholds
    high_disc_targets: int = 0     # targets with disc ratio >= disc_threshold

    # Per-target details
    per_target_efficiency: dict[str, float] = field(default_factory=dict)
    per_target_discrimination: dict[str, float] = field(default_factory=dict)

    # Thresholds used
    efficiency_threshold: float = 0.3
    discrimination_threshold: float = 2.0

    @property
    def sensitivity(self) -> float:
        """Fraction of targets detected (efficiency passes threshold).

        sens = detected_targets / total_targets
        A panel with higher sensitivity catches more resistance mutations.
        """
        if self.total_targets == 0:
            return 0.0
        return self.detected_targets / self.total_targets

    @property
    def specificity(self) -> float:
        """Fraction of detected targets with adequate discrimination.

        spec = high_disc_targets / detected_targets
        High specificity means fewer false-positive resistance calls.
        """
        if self.detected_targets == 0:
            return 0.0
        return self.high_disc_targets / self.detected_targets

    @property
    def coverage(self) -> float:
        """Fraction of targets with at least one passing candidate.

        coverage = covered_targets / total_targets
        Lower thresholds -> higher coverage, but worse individual quality.
        """
        if self.total_targets == 0:
            return 0.0
        return self.covered_targets / self.total_targets

    @property
    def avg_discrimination(self) -> float:
        """Average discrimination ratio across detected targets."""
        values = list(self.per_target_discrimination.values())
        if not values:
            return 0.0
        return sum(values) / len(values)

    @property
    def avg_efficiency(self) -> float:
        """Average predicted efficiency across detected targets."""
        values = list(self.per_target_efficiency.values())
        if not values:
            return 0.0
        return sum(values) / len(values)

    def to_dict(self) -> dict:
        return {
            "sensitivity": round(self.sensitivity, 4),
            "specificity": round(self.specificity, 4),
            "coverage": round(self.coverage, 4),
            "total_targets": self.total_targets,
            "covered_targets": self.covered_targets,
            "detected_targets": self.detected_targets,
            "high_disc_targets": self.high_disc_targets,
            "avg_discrimination": round(self.avg_discrimination, 4),
            "avg_efficiency": round(self.avg_efficiency, 4),
            "efficiency_threshold": self.efficiency_threshold,
            "discrimination_threshold": self.discrimination_threshold,
        }


def compute_metrics(
    members: list[PanelMember],
    candidates_by_target: dict[str, list[ScoredCandidate]],
    efficiency_threshold: float = 0.3,
    discrimination_threshold: float = 2.0,
) -> DiagnosticMetrics:
    """Compute panel-level diagnostic metrics.

    Args:
        members: Panel members with selected candidates.
        candidates_by_target: All available candidates per target label.
        efficiency_threshold: Minimum predicted efficiency to count as "detected".
        discrimination_threshold: Minimum MUT/WT ratio to count as "high discrimination".

    Returns:
        DiagnosticMetrics with sensitivity, specificity, coverage.
    """
    all_labels = set(candidates_by_target.keys())
    for m in members:
        all_labels.add(m.label)

    metrics = DiagnosticMetrics(
        total_targets=len(all_labels),
        efficiency_threshold=efficiency_threshold,
        discrimination_threshold=discrimination_threshold,
    )

    # Coverage: targets with at least one candidate passing efficiency threshold
    for label in all_labels:
        candidates = candidates_by_target.get(label, [])
        if any(sc.composite_score >= efficiency_threshold for sc in candidates):
            metrics.covered_targets += 1

    # Detection and discrimination from selected panel members
    for member in members:
        sc = member.selected_candidate
        eff = sc.composite_score
        disc_ratio = sc.discrimination.ratio if sc.discrimination else 0.0

        metrics.per_target_efficiency[member.label] = eff
        metrics.per_target_discrimination[member.label] = disc_ratio

        if eff >= efficiency_threshold:
            metrics.detected_targets += 1
            if disc_ratio >= discrimination_threshold:
                metrics.high_disc_targets += 1

    return metrics
