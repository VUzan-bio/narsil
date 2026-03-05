"""GUARD visualisation module.

Publication-quality figures for CRISPR-Cas12a crRNA design analysis.
All plots follow Nature Methods / NAR figure conventions:
- Matplotlib with custom rcParams (no seaborn defaults)
- Two-column journal width (180 mm) or single-column (88 mm)
- Consistent colour palette across all figures
- Vector output (PDF/SVG) by default
"""

from guard.viz.style import apply_style, PALETTE, save_figure
from guard.viz.discrimination import DiscriminationHeatmap
from guard.viz.ranking import CandidateRankingPlot
from guard.viz.multiplex import MultiplexMatrixPlot
from guard.viz.benchmark import ModelBenchmarkPlot
from guard.viz.active_learning import ActiveLearningPlot
from guard.viz.target_overview import TargetDashboard

__all__ = [
    "apply_style",
    "PALETTE",
    "save_figure",
    "DiscriminationHeatmap",
    "CandidateRankingPlot",
    "MultiplexMatrixPlot",
    "ModelBenchmarkPlot",
    "ActiveLearningPlot",
    "TargetDashboard",
]
