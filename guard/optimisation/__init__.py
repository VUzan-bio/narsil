"""Block 3: Sensitivity-Specificity Optimization Framework.

Provides tools for exploring the tradeoff between diagnostic sensitivity
(detecting all resistance mutations) and specificity (distinguishing
resistant from susceptible). Clinicians can select parameter profiles
that match their deployment context:

- High sensitivity (field screening): maximize coverage, tolerate lower
  discrimination ratios. Catches rare mutations at the cost of false positives.
- Balanced (WHO TPP): meet WHO Target Product Profile thresholds.
  Sens >= 95%, Spec >= 98% for drug-resistant TB.
- High specificity (confirmatory): maximize discrimination ratios,
  accept fewer covered targets. Minimizes false resistance calls.

Key components:
    DiagnosticMetrics: sensitivity, specificity, coverage calculations
    ParameterProfile: preset threshold configurations
    sweep_parameter: 1D parameter sweep with sens/spec curves
    pareto_frontier: multi-objective Pareto-optimal profiles
    collect_top_k: ranked alternatives per target with tradeoff annotations
"""

from guard.optimisation.metrics import DiagnosticMetrics
from guard.optimisation.profiles import ParameterProfile, get_preset
from guard.optimisation.sweep import sweep_parameter, pareto_frontier
from guard.optimisation.top_k import TargetCandidateSet, collect_top_k

__all__ = [
    "DiagnosticMetrics",
    "ParameterProfile",
    "get_preset",
    "sweep_parameter",
    "pareto_frontier",
    "TargetCandidateSet",
    "collect_top_k",
]
