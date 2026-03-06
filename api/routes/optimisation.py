"""Block 3: Sensitivity-Specificity Optimization API endpoints.

GET  /api/v1/presets       — list available parameter presets
POST /api/v1/sweep         — sweep one parameter, return sens/spec curve
POST /api/v1/pareto        — compute Pareto frontier
POST /api/v1/top-k         — get top-K alternatives per target
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from guard.optimisation.profiles import list_presets, get_preset, ParameterProfile
from guard.optimisation.sweep import sweep_parameter, pareto_frontier
from guard.optimisation.top_k import collect_top_k
from guard.optimisation.metrics import compute_metrics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["optimisation"])

# In-memory cache for the most recent pipeline result (set by pipeline route)
_cached_members: list = []
_cached_candidates: dict = {}


def set_pipeline_result(members: list, candidates_by_target: dict) -> None:
    """Called by the pipeline route after panel assembly to cache results."""
    global _cached_members, _cached_candidates
    _cached_members = members
    _cached_candidates = candidates_by_target


# --- Request/Response models ---

class SweepRequest(BaseModel):
    parameter_name: str = Field(
        description="Parameter to sweep: 'efficiency_threshold' or 'discrimination_threshold'"
    )
    values: list[float] = Field(
        description="Values to evaluate",
        default_factory=lambda: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    )
    base_preset: str = Field(
        default="balanced",
        description="Base profile preset name",
    )


class ParetoRequest(BaseModel):
    efficiency_range: list[float] = Field(
        default=[0.1, 0.8],
        description="[min, max] for efficiency threshold",
    )
    discrimination_range: list[float] = Field(
        default=[1.0, 10.0],
        description="[min, max] for discrimination threshold",
    )
    n_steps: int = Field(default=10, ge=3, le=50)


class TopKRequest(BaseModel):
    k: int = Field(default=5, ge=1, le=20)


# --- Endpoints ---

@router.get("/presets")
async def get_presets() -> list[dict]:
    """Return all available parameter presets."""
    return list_presets()


@router.post("/sweep")
async def run_sweep(request: SweepRequest) -> dict:
    """Sweep one parameter and return the sensitivity/specificity curve."""
    if not _cached_members:
        raise HTTPException(
            status_code=400,
            detail="No pipeline results available. Run the pipeline first.",
        )

    try:
        base_profile = get_preset(request.base_preset)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = sweep_parameter(
        parameter_name=request.parameter_name,
        values=request.values,
        members=_cached_members,
        candidates_by_target=_cached_candidates,
        base_profile=base_profile,
    )

    return result.to_dict()


@router.post("/pareto")
async def run_pareto(request: ParetoRequest) -> dict:
    """Compute the Pareto frontier over efficiency and discrimination thresholds."""
    if not _cached_members:
        raise HTTPException(
            status_code=400,
            detail="No pipeline results available. Run the pipeline first.",
        )

    if len(request.efficiency_range) != 2 or len(request.discrimination_range) != 2:
        raise HTTPException(
            status_code=400,
            detail="efficiency_range and discrimination_range must be [min, max]",
        )

    frontier = pareto_frontier(
        members=_cached_members,
        candidates_by_target=_cached_candidates,
        efficiency_range=tuple(request.efficiency_range),
        discrimination_range=tuple(request.discrimination_range),
        n_steps=request.n_steps,
    )

    return {
        "n_points": len(frontier),
        "frontier": [p.to_dict() for p in frontier],
    }


@router.post("/top-k")
async def get_top_k(request: TopKRequest) -> dict:
    """Get top-K alternative candidates per target with tradeoff annotations."""
    if not _cached_members:
        raise HTTPException(
            status_code=400,
            detail="No pipeline results available. Run the pipeline first.",
        )

    results = collect_top_k(
        members=_cached_members,
        candidates_by_target=_cached_candidates,
        k=request.k,
    )

    return {
        "n_targets": len(results),
        "targets": [r.to_dict() for r in results],
    }


@router.post("/metrics")
async def compute_panel_metrics(
    efficiency_threshold: float = 0.3,
    discrimination_threshold: float = 2.0,
) -> dict:
    """Compute panel metrics with custom thresholds."""
    if not _cached_members:
        raise HTTPException(
            status_code=400,
            detail="No pipeline results available. Run the pipeline first.",
        )

    metrics = compute_metrics(
        members=_cached_members,
        candidates_by_target=_cached_candidates,
        efficiency_threshold=efficiency_threshold,
        discrimination_threshold=discrimination_threshold,
    )

    return metrics.to_dict()
