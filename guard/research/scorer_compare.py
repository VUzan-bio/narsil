"""Compare two scoring models on the same panel results."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def compare_scorers(
    panel_result: dict[str, Any],
    model_a: str,
    model_b: str,
) -> dict[str, Any]:
    """Compare two scoring approaches on a completed panel.

    For MVP: compares the stored heuristic scores (always available)
    with themselves or with ML scores if present in the result data.

    Args:
        panel_result: The raw pipeline result dict (from results JSON).
        model_a: Scorer name ("heuristic", "guard_net", etc.)
        model_b: Scorer name.

    Returns comparison dict with per-target scores and summary.
    """
    members = panel_result.get("members", [])
    if not members:
        # Basic mode results
        return _compare_basic_mode(panel_result, model_a, model_b)

    targets = []
    for member in members:
        target = member.get("target", {})
        mutation = target.get("mutation", {})
        selected = member.get("selected_candidate", {})
        candidate = selected.get("candidate", {})
        heuristic = selected.get("heuristic", {})
        disc = selected.get("discrimination")

        label = mutation.get("label", f"{mutation.get('gene', '')}_{mutation.get('ref_aa', '')}{mutation.get('position', '')}{mutation.get('alt_aa', '')}")

        score_a = _get_score(selected, model_a, heuristic)
        score_b = _get_score(selected, model_b, heuristic)

        disc_ratio = None
        if disc:
            wt = disc.get("wt_activity", 0)
            mut = disc.get("mut_activity", 0)
            if wt > 0:
                disc_ratio = round(mut / wt, 1)

        targets.append({
            "label": label,
            "model_a": {"score": score_a, "disc": disc_ratio},
            "model_b": {"score": score_b, "disc": disc_ratio},
            "score_delta": round(score_b - score_a, 4) if score_a is not None and score_b is not None else None,
        })

    # Rank by score for each model
    sorted_a = sorted(range(len(targets)), key=lambda i: targets[i]["model_a"]["score"] or 0, reverse=True)
    sorted_b = sorted(range(len(targets)), key=lambda i: targets[i]["model_b"]["score"] or 0, reverse=True)

    for rank, idx in enumerate(sorted_a, 1):
        targets[idx]["model_a"]["rank"] = rank
    for rank, idx in enumerate(sorted_b, 1):
        targets[idx]["model_b"]["rank"] = rank

    rank_changes = []
    for t in targets:
        changed = t["model_a"]["rank"] != t["model_b"]["rank"]
        t["rank_changed"] = changed
        if changed:
            rank_changes.append(t["label"])

    # Summary
    deltas = [t["score_delta"] for t in targets if t["score_delta"] is not None]
    rank_agreement = sum(1 for t in targets if not t["rank_changed"])

    return {
        "model_a": model_a,
        "model_b": model_b,
        "targets": targets,
        "summary": {
            "rank_agreement": rank_agreement,
            "total_targets": len(targets),
            "mean_score_delta": round(sum(deltas) / len(deltas), 4) if deltas else 0,
            "rank_changes": rank_changes,
        },
    }


def _get_score(selected: dict, model: str, heuristic: dict) -> float | None:
    """Extract score for a given model from a scored candidate."""
    if model == "heuristic":
        return heuristic.get("composite", 0)

    # Check ML scores
    ml_scores = selected.get("ml_scores", [])
    for ml in ml_scores:
        if ml.get("model_name") == model:
            return ml.get("predicted_efficiency")

    # Check specific fields
    if model in ("guard_net", "guard_net_diagnostic"):
        if selected.get("ensemble_score") is not None:
            return selected["ensemble_score"]
        if selected.get("cnn_calibrated") is not None:
            return selected["cnn_calibrated"]
        if selected.get("cnn_score") is not None:
            return selected["cnn_score"]

    # Fallback to heuristic
    return heuristic.get("composite", 0)


def _compare_basic_mode(result: dict, model_a: str, model_b: str) -> dict:
    """Handle basic mode results (dict of target -> scored list)."""
    targets_data = result.get("targets", {})
    targets = []

    for label, scored_list in targets_data.items():
        if not scored_list:
            continue
        first = scored_list[0]
        heuristic = first.get("heuristic", {})
        score_a = _get_score(first, model_a, heuristic)
        score_b = _get_score(first, model_b, heuristic)

        targets.append({
            "label": label,
            "model_a": {"score": score_a, "disc": None, "rank": 0},
            "model_b": {"score": score_b, "disc": None, "rank": 0},
            "score_delta": round(score_b - score_a, 4) if score_a is not None and score_b is not None else None,
            "rank_changed": False,
        })

    return {
        "model_a": model_a,
        "model_b": model_b,
        "targets": targets,
        "summary": {
            "rank_agreement": len(targets),
            "total_targets": len(targets),
            "mean_score_delta": 0,
            "rank_changes": [],
        },
    }
