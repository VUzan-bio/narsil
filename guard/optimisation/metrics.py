"""Panel-level diagnostic performance metrics aligned with WHO TPP 2024.

These are IN SILICO predictions based on pipeline parameters and
GUARD-Net scores. Real performance requires experimental validation.

The key insight: sensitivity and specificity at the PANEL level depend
on per-target discrimination ratios and scoring thresholds. By sweeping
these thresholds, we trace the sensitivity-specificity tradeoff curve
that defines the panel's clinical operating point.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

import numpy as np

from guard.core.types import ScoredCandidate, PanelMember

# WHO TPP 2024 sensitivity requirements by drug class
WHO_TPP_SENSITIVITY = {
    "rifampicin": {"minimal": 0.95, "optimal": 0.95},
    "isoniazid": {"minimal": 0.90, "optimal": 0.95},
    "fluoroquinolone": {"minimal": 0.90, "optimal": 0.95},
    "ethambutol": {"minimal": 0.80, "optimal": 0.95},
    "pyrazinamide": {"minimal": 0.80, "optimal": 0.95},
    "aminoglycoside": {"minimal": 0.80, "optimal": 0.95},
}
WHO_TPP_SPECIFICITY = {"minimal": 0.98, "optimal": 0.98}


# Drug class mapping for the 14-plex panel
TARGET_DRUG_CLASS = {
    "rpoB_S450L": "rifampicin",
    "rpoB_S450W": "rifampicin",
    "rpoB_H445D": "rifampicin",
    "rpoB_H445Y": "rifampicin",
    "rpoB_D435V": "rifampicin",
    "katG_S315T": "isoniazid",
    "katG_S315N": "isoniazid",
    "inhA_C-15T": "isoniazid",
    "embB_M306V": "ethambutol",
    "embB_M306I": "ethambutol",
    "pncA_H57D": "pyrazinamide",
    "gyrA_D94G": "fluoroquinolone",
    "gyrA_A90V": "fluoroquinolone",
    "rrs_A1401G": "aminoglycoside",
    "IS6110_A1G": "species_control",
}


@dataclass
class TargetMetrics:
    """Per-target metrics for one resistance mutation."""
    label: str
    drug_class: str
    best_score: float
    best_disc: float
    has_candidates: bool
    has_primers: bool
    is_covered: bool             # score >= threshold AND disc >= disc_threshold
    is_assay_ready: bool         # covered AND has primers
    n_candidates: int
    n_above_threshold: int
    detection_strategy: str      # "direct" or "proximity"


@dataclass
class DrugClassMetrics:
    """Aggregated metrics per drug class (e.g., all rifampicin markers)."""
    drug_class: str
    n_targets: int
    n_covered: int
    sensitivity: float
    avg_disc: float
    who_minimal: float
    who_optimal: float
    meets_minimal: bool
    meets_optimal: bool


@dataclass
class DiagnosticMetrics:
    """Complete panel-level diagnostic performance assessment.

    Computes sensitivity, specificity, coverage, and cost at both
    panel-level and per-drug-class level, benchmarked against
    WHO TPP 2024 requirements.
    """
    target_metrics: list[TargetMetrics]
    drug_class_metrics: list[DrugClassMetrics] = field(default_factory=list)

    def __post_init__(self):
        if not self.drug_class_metrics:
            self.drug_class_metrics = self._compute_drug_class_metrics()

    def _compute_drug_class_metrics(self) -> list[DrugClassMetrics]:
        by_class: dict[str, list[TargetMetrics]] = defaultdict(list)
        for t in self.target_metrics:
            if t.drug_class != "species_control":
                by_class[t.drug_class].append(t)

        results = []
        for drug_class in sorted(by_class):
            targets = by_class[drug_class]
            n_targets = len(targets)
            n_covered = sum(1 for t in targets if t.is_assay_ready)
            covered_discs = [t.best_disc for t in targets if t.is_assay_ready]

            who_req = WHO_TPP_SENSITIVITY.get(
                drug_class, {"minimal": 0.80, "optimal": 0.95}
            )
            sensitivity = n_covered / n_targets if n_targets > 0 else 0.0

            results.append(DrugClassMetrics(
                drug_class=drug_class,
                n_targets=n_targets,
                n_covered=n_covered,
                sensitivity=sensitivity,
                avg_disc=float(np.mean(covered_discs)) if covered_discs else 0.0,
                who_minimal=who_req["minimal"],
                who_optimal=who_req["optimal"],
                meets_minimal=sensitivity >= who_req["minimal"],
                meets_optimal=sensitivity >= who_req["optimal"],
            ))
        return results

    @property
    def sensitivity(self) -> float:
        """Panel-level: fraction of resistance targets that are assay-ready."""
        resistance = [t for t in self.target_metrics if t.drug_class != "species_control"]
        if not resistance:
            return 0.0
        return sum(1 for t in resistance if t.is_assay_ready) / len(resistance)

    @property
    def specificity(self) -> float:
        """Panel-level: predicted ability to avoid false positives.
        Proxy: mean(1 - 1/disc) across assay-ready resistance targets.
        disc=3x->0.67, disc=5x->0.80, disc=10x->0.90, disc=20x->0.95"""
        ready = [
            t for t in self.target_metrics
            if t.is_assay_ready and t.drug_class != "species_control"
        ]
        if not ready:
            return 0.0
        return float(np.mean([1.0 - 1.0 / max(t.best_disc, 1.01) for t in ready]))

    @property
    def drug_class_coverage(self) -> float:
        """Fraction of drug classes with at least one assay-ready target."""
        if not self.drug_class_metrics:
            return 0.0
        return sum(
            1 for d in self.drug_class_metrics if d.n_covered > 0
        ) / len(self.drug_class_metrics)

    @property
    def who_compliance(self) -> dict:
        """Check compliance with WHO TPP 2024 per drug class."""
        return {
            d.drug_class: {
                "sensitivity": round(d.sensitivity, 3),
                "meets_minimal": d.meets_minimal,
                "meets_optimal": d.meets_optimal,
                "required_minimal": d.who_minimal,
            }
            for d in self.drug_class_metrics
        }

    @property
    def cost(self) -> dict:
        """Cost estimates for the panel."""
        n_ready = sum(1 for t in self.target_metrics if t.is_assay_ready)
        n_oligos = n_ready * 3  # crRNA + FWD primer + REV primer
        return {
            "assay_ready_targets": n_ready,
            "oligos_to_order": n_oligos,
            "estimated_cost_usd": round(n_oligos * 3.0, 2),
            "cost_per_test_usd": round(n_ready * 0.30, 2),
        }

    @property
    def species_control(self) -> dict:
        """IS6110 species identification control status."""
        controls = [t for t in self.target_metrics if t.drug_class == "species_control"]
        if controls:
            c = controls[0]
            return {"present": True, "assay_ready": c.is_assay_ready, "score": c.best_score}
        return {"present": False}

    def summary(self) -> dict:
        """Complete panel summary for API response."""
        return {
            "panel_sensitivity": round(self.sensitivity, 3),
            "panel_specificity": round(self.specificity, 3),
            "drug_class_coverage": round(self.drug_class_coverage, 3),
            "who_compliance": self.who_compliance,
            "species_control": self.species_control,
            "cost": self.cost,
            "per_drug_class": [
                {
                    "drug_class": d.drug_class,
                    "sensitivity": round(d.sensitivity, 3),
                    "n_covered": d.n_covered,
                    "n_targets": d.n_targets,
                    "avg_discrimination": round(d.avg_disc, 1),
                    "meets_who_minimal": d.meets_minimal,
                }
                for d in self.drug_class_metrics
            ],
            "per_target": [
                {
                    "label": t.label,
                    "drug_class": t.drug_class,
                    "assay_ready": t.is_assay_ready,
                    "score": round(t.best_score, 3),
                    "discrimination": round(t.best_disc, 1),
                    "strategy": t.detection_strategy,
                    "n_candidates": t.n_candidates,
                }
                for t in self.target_metrics
            ],
        }

    def to_dict(self) -> dict:
        return self.summary()


def compute_diagnostic_metrics(
    members: list[PanelMember],
    candidates_by_target: dict[str, list[ScoredCandidate]],
    efficiency_threshold: float = 0.3,
    discrimination_threshold: float = 2.0,
) -> DiagnosticMetrics:
    """Convert pipeline output + profile thresholds into DiagnosticMetrics.

    This is the BRIDGE between the pipeline and the metrics system.
    It reads panel members and all candidates, applies thresholds to
    determine which targets are covered, and produces the full
    DiagnosticMetrics structure with per-drug-class breakdown.

    Args:
        members: Panel members with selected candidates.
        candidates_by_target: All available candidates per target label.
        efficiency_threshold: Minimum predicted efficiency to count as covered.
        discrimination_threshold: Minimum MUT/WT ratio to count as covered.
    """
    target_metrics_list: list[TargetMetrics] = []

    # Collect all known target labels
    all_labels = set(candidates_by_target.keys())
    for m in members:
        all_labels.add(m.label)

    # Build a lookup from label -> member
    member_by_label = {m.label: m for m in members}

    for label in sorted(all_labels):
        candidates = candidates_by_target.get(label, [])
        member = member_by_label.get(label)

        drug_class = TARGET_DRUG_CLASS.get(label, "unknown")

        # Best score and discrimination from the selected member
        if member:
            sc = member.selected_candidate
            best_score = sc.composite_score
            best_disc = sc.discrimination.ratio if sc.discrimination else 0.0
            has_primers = member.primers is not None
            strategy = sc.candidate.detection_strategy.value
        else:
            best_score = 0.0
            best_disc = 0.0
            has_primers = False
            strategy = "none"

        n_above = sum(
            1 for c in candidates if c.composite_score >= efficiency_threshold
        )

        is_covered = (
            best_score >= efficiency_threshold
            and best_disc >= discrimination_threshold
        )
        is_assay_ready = is_covered and has_primers

        target_metrics_list.append(TargetMetrics(
            label=label,
            drug_class=drug_class,
            best_score=best_score,
            best_disc=best_disc,
            has_candidates=len(candidates) > 0,
            has_primers=has_primers,
            is_covered=is_covered,
            is_assay_ready=is_assay_ready,
            n_candidates=len(candidates),
            n_above_threshold=n_above,
            detection_strategy=strategy,
        ))

    return DiagnosticMetrics(target_metrics=target_metrics_list)
