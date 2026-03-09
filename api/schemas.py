"""API request/response models.

Decoupled from guard.core.types — the API layer serializes pipeline
outputs into these response models. No direct import of domain types.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ======================================================================
# Enums
# ======================================================================

class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class PipelineMode(str, Enum):
    BASIC = "basic"
    FULL = "full"


class ExportFormat(str, Enum):
    JSON = "json"
    TSV = "tsv"
    CSV = "csv"
    FASTA = "fasta"


# ======================================================================
# Request models
# ======================================================================

class MutationInput(BaseModel):
    gene: str
    ref_aa: str
    position: int
    alt_aa: str
    drug: str = "OTHER"


class PipelineRunRequest(BaseModel):
    name: str = "GUARD Run"
    mode: PipelineMode = PipelineMode.FULL
    mutations: list[MutationInput]
    config_overrides: dict = Field(default_factory=dict)


# ======================================================================
# Response models
# ======================================================================

class JobResponse(BaseModel):
    job_id: str
    name: str
    status: JobStatus
    mode: PipelineMode
    n_mutations: int
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress: float = 0.0
    current_module: Optional[str] = None
    error: Optional[str] = None


class CandidateSummary(BaseModel):
    candidate_id: str
    spacer_seq: str
    pam_seq: str
    pam_variant: str
    strand: str
    gc_content: float
    detection_strategy: str
    mutation_position_in_spacer: Optional[int] = None
    wt_spacer_seq: Optional[str] = None
    composite_score: float
    cnn_score: Optional[float] = None
    cnn_calibrated: Optional[float] = None
    ensemble_score: Optional[float] = None
    discrimination_ratio: Optional[float] = None
    discrimination: Optional[dict] = None
    disc_method: Optional[str] = None  # "neural", "neural_enhanced", or "feature"
    neural_disc: Optional[float] = None  # Neural disc head prediction (if available)
    feature_disc: Optional[float] = None  # Feature-based disc prediction (if available)
    thermo_ddg: Optional[float] = None  # RNA:DNA hybrid ddG at mismatch (kcal/mol)
    mm_position_pam: Optional[int] = None  # Mismatch position relative to PAM (1-20)
    ml_scores: list[dict] = Field(default_factory=list)
    rank: Optional[int] = None


class TargetResult(BaseModel):
    label: str
    gene: str
    mutation: str
    drug: str
    detection_strategy: str
    n_candidates: int
    selected_candidate: Optional[CandidateSummary] = None
    has_primers: bool = False
    fwd_primer: Optional[str] = None
    rev_primer: Optional[str] = None
    amplicon_length: Optional[int] = None
    proximity_distance: Optional[int] = None
    has_sm: bool = False
    sm_enhanced_spacer: Optional[str] = None
    sm_position: Optional[int] = None
    sm_discrimination_score: Optional[float] = None
    sm_improvement_factor: Optional[float] = None
    sm_original_base: Optional[str] = None
    sm_replacement_base: Optional[str] = None
    asrpa_discrimination: Optional[dict] = None


class PanelSummary(BaseModel):
    plex: int
    complete_targets: int
    panel_score: Optional[float] = None
    mean_discrimination: Optional[float] = None
    direct_count: int = 0
    proximity_count: int = 0


class ModuleStats(BaseModel):
    module_id: str
    module_name: str
    duration_ms: int
    candidates_in: int
    candidates_out: int
    detail: str
    breakdown: dict = Field(default_factory=dict)


class PipelineResultResponse(BaseModel):
    job_id: str
    panel: PanelSummary
    targets: list[TargetResult]
    module_stats: list[ModuleStats] = []
    total_duration_ms: int = 0
    primer_dimer_matrix: Optional[list[list[float]]] = None
    primer_dimer_labels: Optional[list[str]] = None
    primer_dimer_report: Optional[dict] = None


# ======================================================================
# Scoring models (Phase 4)
# ======================================================================

class ScoringModelInfo(BaseModel):
    name: str
    status: str  # "ready", "no_weights", "disabled"
    description: str = ""


class JEPAScoreRequest(BaseModel):
    spacer_sequences: list[str]
    encoder_path: Optional[str] = None


class JEPAScoreResponse(BaseModel):
    predictions: list[dict]


# ======================================================================
# Validation models (Phase 4)
# ======================================================================

class ValidationUpload(BaseModel):
    measurements: list[dict]


class UncertaintyCandidate(BaseModel):
    candidate_id: str
    target_label: str
    spacer_seq: str
    uncertainty: float
    predicted_efficiency: float
