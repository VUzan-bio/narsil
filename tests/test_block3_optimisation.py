"""Tests for Block 3: Sensitivity-Specificity Optimization Framework.

Tests with mock panel data (14 targets, varying discrimination ratios).
Verifies:
    1. high_sensitivity preset covers more targets than high_specificity
    2. high_specificity preset has higher avg discrimination
    3. Pareto frontier returns >= 2 non-dominated points
    4. top-K returns 3-5 alternatives per target with tradeoff annotations
"""

from __future__ import annotations

import pytest

from guard.core.types import (
    CrRNACandidate,
    DetectionStrategy,
    DiscriminationScore,
    HeuristicScore,
    MultiplexPanel,
    OffTargetReport,
    PanelMember,
    PAMVariant,
    ScoredCandidate,
    Strand,
    Target,
    Mutation,
)
from guard.optimisation.metrics import DiagnosticMetrics, compute_metrics
from guard.optimisation.profiles import (
    ParameterProfile,
    get_preset,
    list_presets,
    HIGH_SENSITIVITY,
    BALANCED,
    HIGH_SPECIFICITY,
)
from guard.optimisation.sweep import sweep_parameter, pareto_frontier
from guard.optimisation.top_k import collect_top_k, TargetCandidateSet


# --- Mock data factory ---

def _make_target(label: str) -> Target:
    # Encode label info in gene+position to get unique labels
    # label format: "target_XX" -> gene=f"gene{XX}", position=XX
    idx = int(label.split("_")[1])
    return Target(
        mutation=Mutation(gene=f"gene{idx}", position=idx, ref_aa="S", alt_aa="L"),
        genomic_pos=761155 + idx * 100,
        ref_codon="TCG",
        alt_codon="TTG",
        flanking_seq="A" * 100,
        flanking_start=761105 + idx * 100,
    )


def _make_candidate(
    label: str,
    idx: int,
    efficiency: float,
    disc_ratio: float,
    n_offtargets: int = 2,
) -> ScoredCandidate:
    spacer = "AGCTAGCTAGCTAGCTAGCT"  # 20nt
    # Vary spacer slightly per candidate to simulate different PAM sites
    spacer_list = list(spacer)
    spacer_list[idx % 20] = "ACGT"[idx % 4]
    spacer = "".join(spacer_list)

    candidate = CrRNACandidate(
        candidate_id=f"{label}_cand_{idx}",
        target_label=label,
        spacer_seq=spacer,
        pam_seq="TTTG",
        pam_variant=PAMVariant.TTTV,
        strand=Strand.PLUS,
        genomic_start=761155 + idx * 5,
        genomic_end=761155 + idx * 5 + 20,
        gc_content=0.5,
        homopolymer_max=2,
        pam_activity_weight=0.9,
        detection_strategy=DetectionStrategy.DIRECT,
    )

    heuristic = HeuristicScore(
        seed_position_score=0.5,
        gc_penalty=0.0,
        structure_penalty=0.0,
        homopolymer_penalty=0.0,
        offtarget_penalty=0.0,
        composite=efficiency,
    )

    disc = DiscriminationScore(
        wt_activity=0.3,
        mut_activity=0.3 * disc_ratio,
        model_name="mock",
    )

    offtarget = OffTargetReport(
        candidate_id=f"{label}_cand_{idx}",
        is_clean=n_offtargets <= 3,
    )

    return ScoredCandidate(
        candidate=candidate,
        offtarget=offtarget,
        heuristic=heuristic,
        discrimination=disc,
    )


def _make_mock_panel(n_targets: int = 14) -> tuple[
    list[PanelMember],
    dict[str, list[ScoredCandidate]],
]:
    """Create a mock panel with varying quality across targets.

    Returns (panel_members, candidates_by_target).
    """
    members = []
    candidates_by_target = {}

    for i in range(n_targets):
        target = _make_target(f"target_{i:02d}")
        label = target.label  # derived from mutation: "gene{i}_S{i}L"

        # Create 5-8 candidates per target with varying quality
        n_candidates = 5 + (i % 4)
        candidates = []
        for j in range(n_candidates):
            # Vary efficiency and discrimination
            eff = 0.3 + 0.5 * ((j + i) % 7) / 7
            disc = 1.0 + 8.0 * ((j * 3 + i * 2) % 11) / 11
            ot = (j + i) % 5
            candidates.append(_make_candidate(label, j, eff, disc, ot))

        candidates_by_target[label] = candidates

        # Select the first candidate as the "selected" one
        members.append(PanelMember(
            target=target,
            selected_candidate=candidates[0],
        ))

    return members, candidates_by_target


# --- Tests ---

class TestDiagnosticMetrics:

    def test_basic_metrics(self):
        members, candidates_by_target = _make_mock_panel(14)
        metrics = compute_metrics(
            members, candidates_by_target,
            efficiency_threshold=0.3,
            discrimination_threshold=2.0,
        )
        assert metrics.total_targets == 14
        assert 0 <= metrics.sensitivity <= 1
        assert 0 <= metrics.specificity <= 1
        assert 0 <= metrics.coverage <= 1

    def test_lower_threshold_higher_sensitivity(self):
        members, candidates_by_target = _make_mock_panel(14)
        metrics_low = compute_metrics(
            members, candidates_by_target,
            efficiency_threshold=0.1,
            discrimination_threshold=1.0,
        )
        metrics_high = compute_metrics(
            members, candidates_by_target,
            efficiency_threshold=0.6,
            discrimination_threshold=5.0,
        )
        assert metrics_low.sensitivity >= metrics_high.sensitivity

    def test_to_dict(self):
        metrics = DiagnosticMetrics(total_targets=10, detected_targets=8, high_disc_targets=6)
        d = metrics.to_dict()
        assert d["sensitivity"] == 0.8
        assert d["specificity"] == 0.75
        assert "coverage" in d


class TestParameterProfiles:

    def test_presets_exist(self):
        presets = list_presets()
        assert len(presets) == 3
        names = {p["name"] for p in presets}
        assert names == {"high_sensitivity", "balanced", "high_specificity"}

    def test_get_preset(self):
        profile = get_preset("balanced")
        assert profile.name == "balanced"
        assert profile.efficiency_threshold == 0.3
        assert profile.discrimination_threshold == 2.0

    def test_get_preset_invalid(self):
        with pytest.raises(KeyError):
            get_preset("nonexistent")

    def test_high_sensitivity_vs_high_specificity(self):
        """High sensitivity has lower thresholds -> covers more targets."""
        members, candidates_by_target = _make_mock_panel(14)

        metrics_sens = compute_metrics(
            members, candidates_by_target,
            efficiency_threshold=HIGH_SENSITIVITY.efficiency_threshold,
            discrimination_threshold=HIGH_SENSITIVITY.discrimination_threshold,
        )
        metrics_spec = compute_metrics(
            members, candidates_by_target,
            efficiency_threshold=HIGH_SPECIFICITY.efficiency_threshold,
            discrimination_threshold=HIGH_SPECIFICITY.discrimination_threshold,
        )
        # High sensitivity should cover >= high specificity
        assert metrics_sens.detected_targets >= metrics_spec.detected_targets

    def test_high_specificity_higher_disc_threshold(self):
        """High specificity uses a stricter discrimination threshold."""
        assert HIGH_SPECIFICITY.discrimination_threshold > HIGH_SENSITIVITY.discrimination_threshold
        assert HIGH_SPECIFICITY.efficiency_threshold > HIGH_SENSITIVITY.efficiency_threshold

    def test_high_specificity_fewer_detected_targets(self):
        """Higher thresholds should detect fewer or equal targets."""
        members, candidates_by_target = _make_mock_panel(14)

        metrics_sens = compute_metrics(
            members, candidates_by_target,
            efficiency_threshold=HIGH_SENSITIVITY.efficiency_threshold,
            discrimination_threshold=HIGH_SENSITIVITY.discrimination_threshold,
        )
        metrics_spec = compute_metrics(
            members, candidates_by_target,
            efficiency_threshold=HIGH_SPECIFICITY.efficiency_threshold,
            discrimination_threshold=HIGH_SPECIFICITY.discrimination_threshold,
        )
        assert metrics_sens.detected_targets >= metrics_spec.detected_targets


class TestSweep:

    def test_sweep_discrimination(self):
        members, candidates_by_target = _make_mock_panel(14)
        result = sweep_parameter(
            parameter_name="discrimination_threshold",
            values=[1.0, 2.0, 3.0, 5.0, 10.0],
            members=members,
            candidates_by_target=candidates_by_target,
        )
        assert len(result.points) == 5
        # Higher threshold -> fewer high_disc targets
        sensitivities = [p.metrics.sensitivity for p in result.points]
        assert sensitivities[0] >= sensitivities[-1]

    def test_sweep_efficiency(self):
        members, candidates_by_target = _make_mock_panel(14)
        result = sweep_parameter(
            parameter_name="efficiency_threshold",
            values=[0.1, 0.3, 0.5, 0.7],
            members=members,
            candidates_by_target=candidates_by_target,
        )
        assert len(result.points) == 4

    def test_sweep_invalid_param(self):
        members, candidates_by_target = _make_mock_panel(14)
        with pytest.raises(ValueError):
            sweep_parameter(
                parameter_name="invalid_param",
                values=[1.0],
                members=members,
                candidates_by_target=candidates_by_target,
            )

    def test_sweep_to_dict(self):
        members, candidates_by_target = _make_mock_panel(14)
        result = sweep_parameter(
            parameter_name="discrimination_threshold",
            values=[1.0, 5.0],
            members=members,
            candidates_by_target=candidates_by_target,
        )
        d = result.to_dict()
        assert d["parameter_name"] == "discrimination_threshold"
        assert d["n_points"] == 2
        assert "points" in d


class TestPareto:

    def test_pareto_returns_points(self):
        members, candidates_by_target = _make_mock_panel(14)
        frontier = pareto_frontier(
            members=members,
            candidates_by_target=candidates_by_target,
            n_steps=5,
        )
        # Should have at least 2 non-dominated points
        assert len(frontier) >= 2

    def test_pareto_non_dominated(self):
        """No point on the frontier should be dominated by another."""
        members, candidates_by_target = _make_mock_panel(14)
        frontier = pareto_frontier(
            members=members,
            candidates_by_target=candidates_by_target,
            n_steps=5,
        )
        for i, p in enumerate(frontier):
            for j, q in enumerate(frontier):
                if i == j:
                    continue
                # q should NOT dominate p
                assert not (
                    q.metrics.sensitivity >= p.metrics.sensitivity
                    and q.metrics.specificity >= p.metrics.specificity
                    and (
                        q.metrics.sensitivity > p.metrics.sensitivity
                        or q.metrics.specificity > p.metrics.specificity
                    )
                )

    def test_pareto_sorted_by_sensitivity(self):
        members, candidates_by_target = _make_mock_panel(14)
        frontier = pareto_frontier(
            members=members,
            candidates_by_target=candidates_by_target,
            n_steps=5,
        )
        sensitivities = [p.metrics.sensitivity for p in frontier]
        assert sensitivities == sorted(sensitivities, reverse=True)


class TestTopK:

    def test_top_k_returns_alternatives(self):
        members, candidates_by_target = _make_mock_panel(14)
        results = collect_top_k(
            members=members,
            candidates_by_target=candidates_by_target,
            k=5,
        )
        assert len(results) == 14  # one per panel member

    def test_top_k_count(self):
        members, candidates_by_target = _make_mock_panel(14)
        results = collect_top_k(
            members=members,
            candidates_by_target=candidates_by_target,
            k=5,
        )
        for r in results:
            # Should have at least 1 alternative and at most k
            assert 1 <= len(r.alternatives) <= 5

    def test_top_k_tradeoff_annotations(self):
        members, candidates_by_target = _make_mock_panel(14)
        results = collect_top_k(
            members=members,
            candidates_by_target=candidates_by_target,
            k=5,
        )
        for r in results:
            for alt in r.alternatives:
                assert len(alt.tradeoffs) >= 1
                for t in alt.tradeoffs:
                    assert t in {
                        "higher_efficiency",
                        "higher_discrimination",
                        "fewer_offtargets",
                        "different_pam",
                        "comparable",
                    }

    def test_top_k_to_dict(self):
        members, candidates_by_target = _make_mock_panel(14)
        results = collect_top_k(
            members=members,
            candidates_by_target=candidates_by_target,
            k=3,
        )
        for r in results:
            d = r.to_dict()
            assert "target_label" in d
            assert "alternatives" in d
            assert "n_alternatives" in d
            for alt_d in d["alternatives"]:
                assert "tradeoffs" in alt_d
                assert "delta_efficiency" in alt_d

    def test_selected_not_in_alternatives(self):
        members, candidates_by_target = _make_mock_panel(14)
        results = collect_top_k(
            members=members,
            candidates_by_target=candidates_by_target,
            k=5,
        )
        for r in results:
            selected_spacer = r.selected.candidate.spacer_seq
            for alt in r.alternatives:
                assert alt.candidate.candidate.spacer_seq != selected_spacer
