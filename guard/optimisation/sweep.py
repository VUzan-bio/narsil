"""Parameter sweep and Pareto frontier computation.

sweep_parameter(): Vary one threshold parameter (e.g. discrimination_threshold)
over a range and compute the resulting sensitivity/specificity at each point.
Returns a curve showing the tradeoff.

pareto_frontier(): Given a set of parameter configurations and their
resulting metrics, compute the Pareto-optimal set — configurations where
no other configuration dominates on BOTH sensitivity and specificity.
"""

from __future__ import annotations

import copy
import logging
from dataclasses import dataclass, field

from guard.core.types import PanelMember, ScoredCandidate
from guard.optimisation.metrics import DiagnosticMetrics, compute_metrics
from guard.optimisation.profiles import ParameterProfile, BALANCED

logger = logging.getLogger(__name__)


@dataclass
class SweepPoint:
    """One point on a parameter sweep curve."""
    parameter_name: str
    parameter_value: float
    metrics: DiagnosticMetrics

    def to_dict(self) -> dict:
        return {
            "parameter_name": self.parameter_name,
            "parameter_value": round(self.parameter_value, 4),
            **self.metrics.to_dict(),
        }


@dataclass
class SweepResult:
    """Complete result of a parameter sweep."""
    parameter_name: str
    points: list[SweepPoint]
    base_profile: ParameterProfile

    def to_dict(self) -> dict:
        return {
            "parameter_name": self.parameter_name,
            "n_points": len(self.points),
            "base_profile": self.base_profile.name,
            "points": [p.to_dict() for p in self.points],
        }


def sweep_parameter(
    parameter_name: str,
    values: list[float],
    members: list[PanelMember],
    candidates_by_target: dict[str, list[ScoredCandidate]],
    base_profile: ParameterProfile | None = None,
) -> SweepResult:
    """Sweep one parameter over a range and compute metrics at each point.

    Args:
        parameter_name: Which threshold to sweep. One of:
            "efficiency_threshold", "discrimination_threshold".
        values: List of values to evaluate.
        members: Panel members with selected candidates.
        candidates_by_target: All candidates per target.
        base_profile: Starting profile (other params held constant).
            Defaults to BALANCED.

    Returns:
        SweepResult with sensitivity/specificity at each value.
    """
    if base_profile is None:
        base_profile = copy.deepcopy(BALANCED)

    if parameter_name not in ("efficiency_threshold", "discrimination_threshold"):
        raise ValueError(
            f"Cannot sweep '{parameter_name}'. "
            f"Supported: efficiency_threshold, discrimination_threshold"
        )

    points: list[SweepPoint] = []

    for val in sorted(values):
        profile = copy.deepcopy(base_profile)
        setattr(profile, parameter_name, val)

        metrics = compute_metrics(
            members=members,
            candidates_by_target=candidates_by_target,
            efficiency_threshold=profile.efficiency_threshold,
            discrimination_threshold=profile.discrimination_threshold,
        )

        points.append(SweepPoint(
            parameter_name=parameter_name,
            parameter_value=val,
            metrics=metrics,
        ))

    return SweepResult(
        parameter_name=parameter_name,
        points=points,
        base_profile=base_profile,
    )


@dataclass
class ParetoPoint:
    """A point on the Pareto frontier."""
    profile: ParameterProfile
    metrics: DiagnosticMetrics

    def to_dict(self) -> dict:
        return {
            "profile": self.profile.to_dict(),
            **self.metrics.to_dict(),
        }


def pareto_frontier(
    members: list[PanelMember],
    candidates_by_target: dict[str, list[ScoredCandidate]],
    efficiency_range: tuple[float, float] = (0.1, 0.8),
    discrimination_range: tuple[float, float] = (1.0, 10.0),
    n_steps: int = 10,
) -> list[ParetoPoint]:
    """Compute the Pareto frontier over efficiency and discrimination thresholds.

    Evaluates a grid of (efficiency_threshold, discrimination_threshold) pairs
    and returns the non-dominated set — points where improving sensitivity
    necessarily reduces specificity, and vice versa.

    Args:
        members: Panel members with selected candidates.
        candidates_by_target: All candidates per target.
        efficiency_range: (min, max) for efficiency threshold sweep.
        discrimination_range: (min, max) for discrimination threshold sweep.
        n_steps: Number of steps in each dimension.

    Returns:
        List of ParetoPoint on the non-dominated frontier, sorted by
        decreasing sensitivity.
    """
    # Generate grid
    eff_step = (efficiency_range[1] - efficiency_range[0]) / max(n_steps - 1, 1)
    disc_step = (discrimination_range[1] - discrimination_range[0]) / max(n_steps - 1, 1)

    all_points: list[ParetoPoint] = []

    for i in range(n_steps):
        for j in range(n_steps):
            eff_thresh = efficiency_range[0] + i * eff_step
            disc_thresh = discrimination_range[0] + j * disc_step

            profile = ParameterProfile(
                name=f"grid_{i}_{j}",
                description=f"eff>={eff_thresh:.2f}, disc>={disc_thresh:.2f}",
                efficiency_threshold=eff_thresh,
                discrimination_threshold=disc_thresh,
            )

            metrics = compute_metrics(
                members=members,
                candidates_by_target=candidates_by_target,
                efficiency_threshold=eff_thresh,
                discrimination_threshold=disc_thresh,
            )

            all_points.append(ParetoPoint(profile=profile, metrics=metrics))

    # Extract non-dominated set (maximize both sensitivity and specificity)
    frontier: list[ParetoPoint] = []
    for p in all_points:
        dominated = False
        for q in all_points:
            if (
                q.metrics.sensitivity >= p.metrics.sensitivity
                and q.metrics.specificity >= p.metrics.specificity
                and (
                    q.metrics.sensitivity > p.metrics.sensitivity
                    or q.metrics.specificity > p.metrics.specificity
                )
            ):
                dominated = True
                break
        if not dominated:
            frontier.append(p)

    # Sort by decreasing sensitivity
    frontier.sort(key=lambda p: -p.metrics.sensitivity)

    logger.info(
        "Pareto frontier: %d non-dominated points from %d grid points",
        len(frontier), len(all_points),
    )

    return frontier
