"""
Studies Routes — Curated game batteries with cohort scoring.

v3: Supports generative items (DAT, RAT, Bridge) and evaluative items
(alignment ranking, parsimony LOO, peer rating) with optional break.
"""

import asyncio
import json
import math
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, Any
from postgrest.exceptions import APIError

from app.middleware.participant import get_optional_participant, get_db
from app.services.cache import EmbeddingCache, VocabularyPool
from app.routes.games import get_current_model_versions
from app.services.scoring import (
    calculate_spread_clues_only,
    score_study_dat,
    score_study_rat,
    score_study_bridge,
    compute_alignment_simple,
    get_or_create_foil_sets,
)

router = APIRouter()


# ============================================
# REQUEST / RESPONSE MODELS
# ============================================

class StudyResponse(BaseModel):
    slug: str
    title: str
    description: Optional[str] = None
    game_count: int
    is_active: bool
    participant_count: int
    require_auth: bool = True


class EnrollResponse(BaseModel):
    enrollment_id: int
    study_slug: str
    items_completed: int
    already_enrolled: bool = False


class ConsentResponse(BaseModel):
    consented_at: str


class SurveySubmitRequest(BaseModel):
    timing: str = Field(..., pattern="^(pre|post)$")
    responses: list[dict[str, Any]]


class SurveySubmitResponse(BaseModel):
    timing: str
    submitted_at: str


class ItemConfig(BaseModel):
    """Unified config for both generative and evaluative items."""
    item_number: int
    type: str  # "generative" or "evaluative"
    task: str  # "dat", "rat", "bridge", "alignment_ranking", "parsimony_loo", "peer_rating"
    m: Optional[int] = None
    n: Optional[int] = None
    targets: list[str] = []
    solution: Optional[str] = None
    instructions: str = ""
    min_words: Optional[int] = None
    show_timer: bool = True
    show_worked_example: bool = False
    scoring: Optional[dict] = None
    # Evaluative-specific fields
    stimulus_sets: Optional[dict] = None
    stimulus_set: Optional[dict] = None
    cold_start_sets: Optional[dict] = None
    dimensions: Optional[list[dict]] = None
    source_item: Optional[int] = None
    n_responses_to_rate: Optional[int] = None
    cold_start_threshold: Optional[int] = None
    optional: bool = False


class NextItemResponse(BaseModel):
    """Response for next-item endpoint. game_id is None for evaluative items."""
    game_id: Optional[str] = None
    item_number: int
    config: ItemConfig
    worked_example: Optional[dict] = None
    stimulus: Optional[dict] = None  # For evaluative items
    show_break: bool = False
    resumed: bool = False


class SubmitWordsRequest(BaseModel):
    words: list[str] = Field(..., min_length=1, max_length=10)
    auto_submitted: bool = False
    time_to_complete_ms: Optional[int] = None


class GameScoreResponse(BaseModel):
    game_id: str
    item_number: int
    game_type: str
    scores: dict[str, Any]
    percentiles: Optional[dict[str, Any]] = None
    exact_match: Optional[bool] = None
    insufficient_data: bool = False
    comparison: Optional[dict[str, Any]] = None
    time_to_complete_ms: Optional[int] = None


class SubmitEvaluationRequest(BaseModel):
    response: dict[str, Any]
    time_to_complete_ms: Optional[int] = None


class EvaluationScoreResponse(BaseModel):
    item_number: int
    task: str
    feedback: dict[str, Any]
    correct: Optional[bool] = None


class OptPartialRequest(BaseModel):
    opted_partial: bool


class ProgressResponse(BaseModel):
    study_slug: str
    enrollment_id: int
    items_completed: int
    total_items: int
    completed_at: Optional[str] = None
    consented_at: Optional[str] = None
    opted_partial: Optional[bool] = None
    pre_survey_done: bool = False
    post_survey_done: bool = False
    game_scores: list[dict[str, Any]]
    evaluation_scores: list[dict[str, Any]] = []


class DashboardData(BaseModel):
    study_slug: str
    study_title: str
    participant_count: int
    insufficient_data: bool = False
    aggregate_percentiles: Optional[dict[str, float]] = None
    per_game_scores: list[dict[str, Any]]
    scatterplot_data: Optional[list[dict[str, Any]]] = None
    learning_curve: Optional[list[dict[str, Any]]] = None
    comparison_charts: Optional[list[dict[str, Any]]] = None
    peer_feedback: Optional[dict[str, Any]] = None


class GroupResultsData(BaseModel):
    """Public aggregate data for the group results dashboard."""
    study_slug: str
    study_title: str
    participant_count: int
    date_range: Optional[dict[str, str]] = None
    cohort_distributions: Optional[dict[str, Any]] = None
    scatterplot_data: Optional[list[dict[str, Any]]] = None
    constraint_effects: Optional[dict[str, Any]] = None
    learning_curve: Optional[list[dict[str, Any]]] = None
    validation: Optional[dict[str, Any]] = None
    feedback: Optional[dict[str, Any]] = None
    user_scores: Optional[dict[str, Any]] = None


# ============================================
# HELPERS
# ============================================

def _parse_study_config(raw_config) -> tuple[list, dict | None, int | None]:
    """Parse study config, handling both v2 (plain array) and v3 (wrapper object)."""
    if isinstance(raw_config, str):
        raw_config = json.loads(raw_config)

    if isinstance(raw_config, list):
        # v2 format: plain array of game configs
        return raw_config, None, None

    # v3 format: {"battery": [...], "worked_example": {...}, "optional_break_after_item": N}
    battery = raw_config.get("battery", [])
    worked_example = raw_config.get("worked_example")
    optional_break = raw_config.get("optional_break_after_item")
    return battery, worked_example, optional_break


def _battery_item_to_config(item: dict) -> ItemConfig:
    """Convert a raw battery item dict to an ItemConfig model."""
    # Handle v2 format (has game_number, type is task name directly)
    if "game_number" in item and "task" not in item:
        task = item["type"]  # v2: type was "dat"/"rat"/"bridge"
        return ItemConfig(
            item_number=item["game_number"],
            type="generative",
            task=task,
            m=item.get("m", 0),
            n=item.get("n", 1),
            targets=item.get("targets", []),
            solution=item.get("solution"),
            instructions=item.get("instructions", ""),
            min_words=1,
            show_timer=True,
            show_worked_example=item.get("show_worked_example", False),
        )
    # v3 format
    return ItemConfig(**{k: v for k, v in item.items() if k in ItemConfig.model_fields})


def _parse_embedding(raw) -> list[float]:
    """Parse embedding from DB (may be string or list)."""
    if isinstance(raw, str):
        return json.loads(raw)
    return raw


async def _get_vocab_embeddings_matrix():
    """Get vocabulary embeddings as numpy array for scoring."""
    pool = VocabularyPool.get_instance()
    if not pool.is_initialized or pool.size == 0:
        return None
    return pool.matrix


async def _get_peer_responses(supabase, slug: str, user_id: str, source_item: int, config_item: dict) -> dict:
    """Get peer responses for peer rating task. Falls back to cold-start sets."""
    threshold = config_item.get("cold_start_threshold", 5)

    # Query completed submissions for the source item, excluding current user
    result = supabase.table("games") \
        .select("id, sender_input, sender_scores") \
        .eq("study_slug", slug) \
        .eq("game_number", source_item) \
        .eq("status", "completed") \
        .neq("sender_id", user_id) \
        .execute()

    submissions = result.data or []

    if len(submissions) < threshold:
        # Use cold-start pre-constructed sets
        cold_start = config_item.get("cold_start_sets", {})
        responses = []
        for key in sorted(cold_start.keys()):
            cs = cold_start[key]
            responses.append({
                "label": f"Response {key}",
                "words": cs["words"],
                "game_id": None,
                "is_preconstructed": True,
                "precomputed_scores": {
                    "divergence": cs.get("precomputed_divergence"),
                    "alignment": cs.get("precomputed_alignment"),
                    "parsimony": cs.get("precomputed_parsimony"),
                },
            })
        return {"responses": responses[:2], "is_preconstructed": True}

    # Sample 2 diverse responses (prefer one high-alignment, one low)
    scored = [s for s in submissions if s.get("sender_scores") and s["sender_scores"].get("alignment") is not None]
    if len(scored) >= 2:
        scored.sort(key=lambda s: s["sender_scores"]["alignment"])
        # Pick from bottom and top tertile
        low = scored[:max(1, len(scored) // 3)]
        high = scored[-max(1, len(scored) // 3):]
        import random
        pick_low = random.choice(low)
        pick_high = random.choice(high)
        selected = [pick_low, pick_high]
    else:
        import random
        selected = random.sample(submissions, min(2, len(submissions)))

    responses = []
    for i, sub in enumerate(selected):
        clues = (sub.get("sender_input") or {}).get("clues", [])
        responses.append({
            "label": f"Response {i + 1}",
            "words": clues,
            "game_id": sub["id"],
            "is_preconstructed": False,
            "precomputed_scores": sub.get("sender_scores"),
        })

    return {"responses": responses, "is_preconstructed": False}


def _increment_items_completed(supabase, slug: str, user_id: str):
    """Increment both items_completed and games_completed on enrollment."""
    enrollment = supabase.table("study_enrollments") \
        .select("items_completed, games_completed") \
        .eq("study_slug", slug) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    items = (enrollment.data.get("items_completed") or 0) + 1
    games = (enrollment.data.get("games_completed") or 0) + 1
    supabase.table("study_enrollments") \
        .update({"items_completed": items, "games_completed": games}) \
        .eq("study_slug", slug) \
        .eq("user_id", user_id) \
        .execute()


def _increment_items_only(supabase, slug: str, user_id: str):
    """Increment only items_completed (for evaluative items that don't create games rows)."""
    enrollment = supabase.table("study_enrollments") \
        .select("items_completed") \
        .eq("study_slug", slug) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    items = (enrollment.data.get("items_completed") or 0) + 1
    supabase.table("study_enrollments") \
        .update({"items_completed": items}) \
        .eq("study_slug", slug) \
        .eq("user_id", user_id) \
        .execute()


def _count_completed_participants(slug: str) -> int:
    """Count completed participants using service client to bypass RLS."""
    svc = get_db()
    result = svc.table("study_enrollments") \
        .select("id", count="exact") \
        .eq("study_slug", slug) \
        .not_.is_("completed_at", "null") \
        .execute()
    return result.count or 0


# ============================================
# ROUTES
# ============================================


class StudyListEnrollment(BaseModel):
    items_completed: int
    completed_at: Optional[str] = None
    opted_partial: Optional[bool] = None
    enrolled_at: str


class StudyListItem(BaseModel):
    slug: str
    title: str
    description: Optional[str] = None
    is_active: bool
    game_count: int
    participant_count: int
    created_at: str
    enrollment: Optional[StudyListEnrollment] = None


class StudyListResponse(BaseModel):
    studies: list[StudyListItem]


@router.get("/", response_model=StudyListResponse)
async def list_studies(auth=Depends(get_optional_participant)):
    """List all studies with participant counts. If authenticated, includes enrollment status."""
    supabase, participant_id = auth

    # Get all studies
    studies_result = supabase.table("studies") \
        .select("slug, title, description, is_active, config, created_at") \
        .order("is_active", desc=True) \
        .order("created_at", desc=True) \
        .execute()

    studies_data = studies_result.data or []
    if not studies_data:
        return StudyListResponse(studies=[])

    slugs = [s["slug"] for s in studies_data]

    # Get participant counts per study using service client to bypass RLS
    svc = get_db()
    counts_result = svc.table("study_enrollments") \
        .select("study_slug, id") \
        .in_("study_slug", slugs) \
        .not_.is_("completed_at", "null") \
        .execute()

    # Count per slug manually since supabase doesn't group
    count_map: dict[str, int] = {}
    for row in (counts_result.data or []):
        slug = row["study_slug"]
        count_map[slug] = count_map.get(slug, 0) + 1

    # If authenticated, get user's enrollments
    enrollment_map: dict[str, dict] = {}
    if participant_id:
        enroll_result = supabase.table("study_enrollments") \
            .select("study_slug, items_completed, completed_at, opted_partial, enrolled_at") \
            .eq("user_id", participant_id) \
            .in_("study_slug", slugs) \
            .execute()
        for row in (enroll_result.data or []):
            enrollment_map[row["study_slug"]] = row

    items = []
    for study in studies_data:
        battery, _, _ = _parse_study_config(study.get("config", []))
        slug = study["slug"]

        enrollment = None
        if slug in enrollment_map:
            e = enrollment_map[slug]
            enrollment = StudyListEnrollment(
                items_completed=e.get("items_completed", 0),
                completed_at=e.get("completed_at"),
                opted_partial=e.get("opted_partial"),
                enrolled_at=e["enrolled_at"],
            )

        items.append(StudyListItem(
            slug=slug,
            title=study["title"],
            description=study.get("description"),
            is_active=study["is_active"],
            game_count=len(battery),
            participant_count=count_map.get(slug, 0),
            created_at=study["created_at"],
            enrollment=enrollment,
        ))

    return StudyListResponse(studies=items)


@router.get("/{slug}", response_model=StudyResponse)
async def get_study(slug: str, auth=Depends(get_optional_participant)):
    """Get study metadata and participant count (public)."""
    supabase, _ = auth

    try:
        result = supabase.table("studies") \
            .select("*") \
            .eq("slug", slug) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail="Study not found")

    if not result.data:
        raise HTTPException(status_code=404, detail="Study not found")

    study = result.data
    battery, _, _ = _parse_study_config(study.get("config", []))

    participant_count = _count_completed_participants(slug)

    return StudyResponse(
        slug=study["slug"],
        title=study["title"],
        description=study.get("description"),
        game_count=len(battery),
        is_active=study["is_active"],
        participant_count=participant_count,
        require_auth=study.get("require_auth", True),
    )




@router.get("/{slug}/group-results", response_model=GroupResultsData)
async def get_group_results(slug: str, auth=Depends(get_optional_participant)):
    """Public aggregate results for the group dashboard. Auth optional for personal overlay."""
    _, participant_id = auth
    svc = get_db()

    try:
        study_result = svc.table("studies") \
            .select("title, config, post_survey") \
            .eq("slug", slug) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail="Study not found")

    battery, _, _ = _parse_study_config(study_result.data.get("config", []))
    participant_count = _count_completed_participants(slug)

    # Date range from enrollments
    date_range = None
    enrollments = svc.table("study_enrollments") \
        .select("completed_at") \
        .eq("study_slug", slug) \
        .not_.is_("completed_at", "null") \
        .order("completed_at") \
        .execute()
    if enrollments.data:
        date_range = {
            "first": enrollments.data[0]["completed_at"],
            "last": enrollments.data[-1]["completed_at"],
        }

    # Fetch all completed games (service client bypasses RLS)
    all_games = svc.table("games") \
        .select("sender_id, game_number, sender_scores, game_type") \
        .eq("study_slug", slug) \
        .eq("status", "completed") \
        .order("game_number") \
        .execute()
    games_data = all_games.data or []

    def _get_alignment_display(scores: dict) -> float | None:
        """Extract the sigmoid-transformed alignment score."""
        import math
        # Best: alignment_display already computed
        ad = scores.get("alignment_display")
        if ad is not None:
            return float(ad)
        # Compute sigmoid from alignment_z if available
        az = scores.get("alignment_z")
        if az is not None:
            c, beta = 1.5, 0.8
            return 100.0 / (1.0 + math.exp(-beta * (float(az) - c)))
        # Fallback: raw alignment * 100 (should only happen for non-backfilled games)
        raw = scores.get("alignment")
        if raw is not None:
            return float(raw) * 100 if float(raw) <= 1 else float(raw)
        return None

    # --- Cohort distributions (N≥20 for histograms, else mean/SD) ---
    cohort_distributions = None
    if participant_count >= 5:
        # Group games by participant, compute aggregate percentile per metric
        participants = {}
        for g in games_data:
            sid = g["sender_id"]
            if sid not in participants:
                participants[sid] = []
            participants[sid].append(g)

        # Per-item percentile ranks for each participant
        def compute_participant_aggregates(extract_fn):
            """For each participant, compute mean percentile across items for a metric."""
            items = {}
            for g in games_data:
                scores = g.get("sender_scores") or {}
                val = extract_fn(scores)
                if val is None:
                    continue
                item = g["game_number"]
                if item not in items:
                    items[item] = []
                items[item].append((g["sender_id"], val))

            participant_pcts = {}
            for item, entries in items.items():
                vals = [v for _, v in entries]
                n = len(vals)
                if n < 2:
                    continue
                for sid, val in entries:
                    count_below = sum(1 for v in vals if v <= val)
                    pct = 100 * count_below / n
                    if sid not in participant_pcts:
                        participant_pcts[sid] = []
                    participant_pcts[sid].append(pct)

            return [sum(pcts) / len(pcts) for pcts in participant_pcts.values() if pcts]

        dists = {}
        for key, extract_fn in [
            ("divergence", lambda s: s.get("divergence")),
            ("alignment", _get_alignment_display),
            ("parsimony", lambda s: s.get("parsimony")),
        ]:
            values = compute_participant_aggregates(extract_fn)
            if values:
                mean_val = sum(values) / len(values)
                sorted_vals = sorted(values)
                n = len(sorted_vals)
                median_val = sorted_vals[n // 2] if n % 2 == 1 else (sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2
                sd_val = (sum((v - mean_val) ** 2 for v in values) / max(n - 1, 1)) ** 0.5
                dists[key] = {
                    "values": [round(v, 1) for v in values],
                    "mean": round(mean_val, 1),
                    "median": round(median_val, 1),
                    "sd": round(sd_val, 1),
                }
        cohort_distributions = dists if dists else None

    # --- Scatterplot data (N≥5, all Bridge items) ---
    scatterplot_data = None
    if participant_count >= 5:
        scatter = []
        for g in games_data:
            scores = g.get("sender_scores") or {}
            item_num = g["game_number"]
            item_cfg = battery[item_num - 1] if item_num <= len(battery) else {}
            task = item_cfg.get("task", g.get("game_type", ""))
            if task != "bridge":
                continue
            div = scores.get("divergence")
            ali = _get_alignment_display(scores)
            if div is None or ali is None:
                continue
            scatter.append({
                "item_number": item_num,
                "divergence": round(div, 1),
                "alignment": round(ali, 1),
                "parsimony": round(scores["parsimony"], 2) if scores.get("parsimony") is not None else None,
                "m": item_cfg.get("m"),
                "n": item_cfg.get("n"),
            })
        scatterplot_data = scatter if scatter else None

    # --- Constraint effects: item 4 (5,3) vs item 8 (3,5) ---
    constraint_effects = None
    if participant_count >= 5:
        i4_par, i8_par, i4_ali, i8_ali = [], [], [], []
        for g in games_data:
            scores = g.get("sender_scores") or {}
            if g["game_number"] == 4:
                if scores.get("parsimony") is not None:
                    i4_par.append(round(scores["parsimony"], 2))
                ali = _get_alignment_display(scores)
                if ali is not None:
                    i4_ali.append(round(ali, 1))
            elif g["game_number"] == 8:
                if scores.get("parsimony") is not None:
                    i8_par.append(round(scores["parsimony"], 2))
                ali = _get_alignment_display(scores)
                if ali is not None:
                    i8_ali.append(round(ali, 1))
        if i4_par and i8_par:
            constraint_effects = {
                "item_4_parsimony": i4_par,
                "item_8_parsimony": i8_par,
                "item_4_alignment": i4_ali,
                "item_8_alignment": i8_ali,
            }

    # --- Learning curve: mean ± SE per item (N≥10 full completers) ---
    learning_curve = None
    # Count full completers (all 10 items)
    full_completers = set()
    items_per_participant = {}
    for g in games_data:
        sid = g["sender_id"]
        if sid not in items_per_participant:
            items_per_participant[sid] = set()
        items_per_participant[sid].add(g["game_number"])
    for sid, items in items_per_participant.items():
        gen_items = {i for i in items if i in {1, 2, 3, 4, 8, 9, 10}}
        if len(gen_items) >= 7:  # All 7 generative items
            full_completers.add(sid)

    if len(full_completers) >= 10:
        # Collect scores per item from full completers only
        item_scores = {}
        for g in games_data:
            if g["sender_id"] not in full_completers:
                continue
            item_num = g["game_number"]
            scores = g.get("sender_scores") or {}
            if item_num not in item_scores:
                item_scores[item_num] = {"divergence": [], "alignment": [], "parsimony": []}
            if scores.get("divergence") is not None:
                item_scores[item_num]["divergence"].append(scores["divergence"])
            ali = _get_alignment_display(scores)
            if ali is not None:
                item_scores[item_num]["alignment"].append(ali)
            if scores.get("parsimony") is not None:
                item_scores[item_num]["parsimony"].append(scores["parsimony"])

        curve = []
        for item_num in [1, 2, 3, 4, 8, 9, 10]:
            if item_num not in item_scores:
                continue
            item_cfg = battery[item_num - 1] if item_num <= len(battery) else {}
            entry = {
                "item_number": item_num,
                "game_type": item_cfg.get("task", ""),
                "m": item_cfg.get("m"),
                "n": item_cfg.get("n"),
            }
            for metric in ["divergence", "alignment", "parsimony"]:
                vals = item_scores[item_num][metric]
                if vals:
                    mean = sum(vals) / len(vals)
                    se = (sum((v - mean) ** 2 for v in vals) / max(len(vals) - 1, 1)) ** 0.5 / max(len(vals) ** 0.5, 1)
                    entry[f"{metric}_mean"] = round(mean, 2)
                    entry[f"{metric}_se"] = round(se, 2)
                else:
                    entry[f"{metric}_mean"] = None
                    entry[f"{metric}_se"] = None
            curve.append(entry)
        learning_curve = curve if curve else None

    # --- Validation panels (N≥10) ---
    validation = None
    if participant_count >= 10:
        val = {}

        # Alignment ranking (item 5)
        try:
            evals_5 = svc.table("study_evaluations") \
                .select("response") \
                .eq("study_slug", slug) \
                .eq("item_number", 5) \
                .execute()
            if evals_5.data:
                counts = {"A": 0, "B": 0, "C": 0}
                for row in evals_5.data:
                    resp = row.get("response")
                    if isinstance(resp, str):
                        resp = json.loads(resp)
                    ranking = (resp or {}).get("ranking", [])
                    if ranking:
                        first = ranking[0]
                        if first in counts:
                            counts[first] += 1
                total = sum(counts.values())
                # Binomial test: max count vs chance (1/3)
                if total > 0:
                    max_count = max(counts.values())
                    # Approximate p-value using normal approximation to binomial
                    expected = total / 3
                    p_val = None
                    if total >= 10:
                        z = (max_count - expected) / max((expected * (1 - 1/3)) ** 0.5, 0.001)
                        # One-tailed p from z-score (approximation)
                        p_val = round(max(0.0001, 0.5 * math.erfc(z / math.sqrt(2))), 4)
                    val["alignment_ranking"] = {"counts": counts, "total": total, "p_value": p_val}
        except Exception:
            pass

        # Parsimony LOO (item 6)
        try:
            evals_6 = svc.table("study_evaluations") \
                .select("response") \
                .eq("study_slug", slug) \
                .eq("item_number", 6) \
                .execute()
            if evals_6.data:
                item_6_cfg = battery[5] if len(battery) >= 6 else {}
                expected_word = item_6_cfg.get("stimulus_set", {}).get("expected_redundant", "spark")
                all_words = item_6_cfg.get("stimulus_set", {}).get("words", [])
                counts = {w: 0 for w in all_words}
                for row in evals_6.data:
                    resp = row.get("response")
                    if isinstance(resp, str):
                        resp = json.loads(resp)
                    w = (resp or {}).get("selected_word") or (resp or {}).get("selected")
                    if w in counts:
                        counts[w] += 1
                total = sum(counts.values())
                p_val = None
                if total >= 10:
                    correct_count = counts.get(expected_word, 0)
                    chance = 1 / max(len(all_words), 1)
                    expected_n = total * chance
                    z = (correct_count - expected_n) / max((expected_n * (1 - chance)) ** 0.5, 0.001)
                    p_val = round(max(0.0001, 0.5 * math.erfc(z / math.sqrt(2))), 4)
                val["parsimony_loo"] = {
                    "counts": counts,
                    "correct_word": expected_word,
                    "total": total,
                    "p_value": p_val,
                }
        except Exception:
            pass

        # Peer rating correlations
        try:
            # Get all peer ratings with the scored game's metrics
            ratings_result = svc.table("peer_ratings") \
                .select("difference, connection, uniqueness, rated_game_id") \
                .execute()
            if ratings_result.data:
                # Get scores for rated games
                game_ids = list({r["rated_game_id"] for r in ratings_result.data})
                # Fetch in chunks to avoid URL length limits
                game_scores_map = {}
                for i in range(0, len(game_ids), 50):
                    chunk = game_ids[i:i+50]
                    games_result = svc.table("games") \
                        .select("id, sender_scores") \
                        .eq("study_slug", slug) \
                        .in_("id", chunk) \
                        .execute()
                    for g in (games_result.data or []):
                        game_scores_map[g["id"]] = g.get("sender_scores") or {}

                # Build paired arrays
                pairs = []
                for r in ratings_result.data:
                    gscores = game_scores_map.get(r["rated_game_id"])
                    if not gscores:
                        continue
                    div = gscores.get("divergence")
                    ali = _get_alignment_display(gscores)
                    par = gscores.get("parsimony")
                    if div is not None and ali is not None and par is not None:
                        pairs.append({
                            "diff": r["difference"], "conn": r["connection"], "uniq": r["uniqueness"],
                            "div": div, "ali": ali, "par": par,
                        })

                if len(pairs) >= 5:
                    def pearson_r(xs, ys):
                        n = len(xs)
                        if n < 3:
                            return None
                        mx, my = sum(xs) / n, sum(ys) / n
                        cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
                        sx = sum((x - mx) ** 2 for x in xs) ** 0.5
                        sy = sum((y - my) ** 2 for y in ys) ** 0.5
                        if sx == 0 or sy == 0:
                            return None
                        return round(cov / (sx * sy), 2)

                    val["peer_correlations"] = {
                        "diff_div_r": pearson_r([p["diff"] for p in pairs], [p["div"] for p in pairs]),
                        "conn_ali_r": pearson_r([p["conn"] for p in pairs], [p["ali"] for p in pairs]),
                        "uniq_par_r": pearson_r([p["uniq"] for p in pairs], [p["par"] for p in pairs]),
                        "n": len(pairs),
                    }
        except Exception:
            pass

        validation = val if val else None

    # --- Participant feedback (N≥5 post-surveys) ---
    feedback = None
    try:
        surveys = svc.table("study_surveys") \
            .select("responses") \
            .eq("study_slug", slug) \
            .eq("timing", "post") \
            .execute()

        post_survey_items = study_result.data.get("post_survey", [])
        if isinstance(post_survey_items, str):
            post_survey_items = json.loads(post_survey_items)

        if surveys.data and len(surveys.data) >= 5:
            # Build response map: item_id -> list of values
            response_map = {}
            free_texts = []
            for row in surveys.data:
                resps = row.get("responses", [])
                if isinstance(resps, str):
                    resps = json.loads(resps)
                for r in resps:
                    item_id = r.get("item_id")
                    value = r.get("value")
                    if item_id == "free_text" and value:
                        free_texts.append(str(value))
                    elif isinstance(value, (int, float)):
                        if item_id not in response_map:
                            response_map[item_id] = []
                        response_map[item_id].append(int(value))

            # Build feedback items from post_survey definition
            items = []
            for ps_item in post_survey_items:
                item_id = ps_item.get("id")
                if item_id == "free_text" or ps_item.get("type") != "likert":
                    continue
                vals = response_map.get(item_id, [])
                if not vals:
                    continue
                mean = round(sum(vals) / len(vals), 1)
                dist = [0, 0, 0, 0, 0]
                for v in vals:
                    if 1 <= v <= 5:
                        dist[v - 1] += 1
                items.append({
                    "label": ps_item.get("text", item_id),
                    "key": item_id,
                    "mean": mean,
                    "distribution": dist,
                    "n": len(vals),
                })

            feedback = {
                "items": items,
                "quotes": free_texts,
            }
    except Exception:
        pass

    # --- User's personal scores (when authenticated) ---
    user_scores = None
    if participant_id and games_data:
        user_id = participant_id
        my_games = [g for g in games_data if g["sender_id"] == user_id]
        if my_games:
            per_item = []
            for g in my_games:
                scores = g.get("sender_scores") or {}
                item_num = g["game_number"]
                item_cfg = battery[item_num - 1] if item_num <= len(battery) else {}
                ali = _get_alignment_display(scores)
                per_item.append({
                    "item_number": item_num,
                    "game_type": item_cfg.get("task", g.get("game_type", "")),
                    "m": item_cfg.get("m"),
                    "n": item_cfg.get("n"),
                    "divergence": scores.get("divergence"),
                    "alignment": round(ali, 1) if ali is not None else None,
                    "parsimony": scores.get("parsimony"),
                })

            # Compute aggregate percentiles for this user
            agg_pcts = {}
            for display_key, extract_fn in [
                ("divergence", lambda s: s.get("divergence")),
                ("alignment", _get_alignment_display),
                ("parsimony", lambda s: s.get("parsimony")),
            ]:
                pcts = []
                for g in my_games:
                    scores = g.get("sender_scores") or {}
                    val = extract_fn(scores)
                    if val is None:
                        continue
                    same_item = [
                        gg["sender_scores"] for gg in games_data
                        if gg["game_number"] == g["game_number"] and gg.get("sender_scores")
                    ]
                    vals = [v for s in same_item if (v := extract_fn(s)) is not None]
                    if vals:
                        count_below = sum(1 for v in vals if v <= val)
                        pcts.append(100 * count_below / len(vals))
                if pcts:
                    agg_pcts[display_key] = round(sum(pcts) / len(pcts), 1)

            user_scores = {
                "per_item": per_item,
                "aggregate_percentiles": agg_pcts if agg_pcts else None,
            }

    return GroupResultsData(
        study_slug=slug,
        study_title=study_result.data["title"],
        participant_count=participant_count,
        date_range=date_range,
        cohort_distributions=cohort_distributions,
        scatterplot_data=scatterplot_data,
        constraint_effects=constraint_effects,
        learning_curve=learning_curve,
        validation=validation,
        feedback=feedback,
        user_scores=user_scores,
    )


@router.get("/{slug}/survey/{timing}")
async def get_survey_items(slug: str, timing: str, auth=Depends(get_optional_participant)):
    """Get survey items for a study."""
    supabase, _ = auth

    if timing not in ("pre", "post"):
        raise HTTPException(status_code=400, detail="timing must be 'pre' or 'post'")

    try:
        result = supabase.table("studies") \
            .select("pre_survey, post_survey") \
            .eq("slug", slug) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail="Study not found")

    survey_key = f"{timing}_survey"
    items = result.data.get(survey_key, [])
    if isinstance(items, str):
        items = json.loads(items)

    return {"timing": timing, "items": items}
