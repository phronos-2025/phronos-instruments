"""
Studies Routes — Curated game batteries with cohort scoring.

v3: Supports generative items (DAT, RAT, Bridge) and evaluative items
(alignment ranking, parsimony LOO, peer rating) with optional break.
"""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, Any
from postgrest.exceptions import APIError

from app.middleware.auth import get_authenticated_client, get_optional_client
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
    import numpy as np
    pool = VocabularyPool.get_instance()
    if not pool.is_initialized or pool.size == 0:
        return None
    items = pool.get_random_with_embeddings(pool.size)
    if not items:
        return None
    return np.array([emb for _, emb in items])


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
async def list_studies(auth=Depends(get_optional_client)):
    """List all studies with participant counts. If authenticated, includes enrollment status."""
    supabase, user = auth

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

    # Get participant counts per study (completed enrollments)
    counts_result = supabase.table("study_enrollments") \
        .select("study_slug, id", count="exact") \
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
    if user:
        enroll_result = supabase.table("study_enrollments") \
            .select("study_slug, items_completed, completed_at, opted_partial, enrolled_at") \
            .eq("user_id", user["id"]) \
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
async def get_study(slug: str, auth=Depends(get_optional_client)):
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

    count_result = supabase.table("study_enrollments") \
        .select("id", count="exact") \
        .eq("study_slug", slug) \
        .not_.is_("completed_at", "null") \
        .execute()

    participant_count = count_result.count or 0

    return StudyResponse(
        slug=study["slug"],
        title=study["title"],
        description=study.get("description"),
        game_count=len(battery),
        is_active=study["is_active"],
        participant_count=participant_count,
        require_auth=study.get("require_auth", True),
    )


@router.post("/{slug}/enroll", response_model=EnrollResponse)
async def enroll_in_study(slug: str, auth=Depends(get_authenticated_client)):
    """Enroll the authenticated user in a study."""
    supabase, user = auth

    try:
        supabase.table("studies") \
            .select("slug") \
            .eq("slug", slug) \
            .eq("is_active", True) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail="Study not found")

    existing = supabase.table("study_enrollments") \
        .select("*") \
        .eq("study_slug", slug) \
        .eq("user_id", user["id"]) \
        .execute()

    if existing.data and len(existing.data) > 0:
        enrollment = existing.data[0]
        return EnrollResponse(
            enrollment_id=enrollment["id"],
            study_slug=slug,
            items_completed=enrollment.get("items_completed") or enrollment.get("games_completed", 0),
            already_enrolled=True,
        )

    result = supabase.table("study_enrollments") \
        .insert({"study_slug": slug, "user_id": user["id"]}) \
        .execute()

    enrollment = result.data[0]
    return EnrollResponse(
        enrollment_id=enrollment["id"],
        study_slug=slug,
        items_completed=0,
        already_enrolled=False,
    )


@router.post("/{slug}/consent", response_model=ConsentResponse)
async def record_consent(slug: str, auth=Depends(get_authenticated_client)):
    """Record consent for a study."""
    supabase, user = auth
    now = datetime.now(timezone.utc).isoformat()

    supabase.table("study_enrollments") \
        .update({"consented_at": now}) \
        .eq("study_slug", slug) \
        .eq("user_id", user["id"]) \
        .execute()

    try:
        supabase.table("users") \
            .update({"terms_accepted_at": now}) \
            .eq("id", user["id"]) \
            .is_("terms_accepted_at", "null") \
            .execute()
    except Exception:
        pass

    return ConsentResponse(consented_at=now)


@router.post("/{slug}/survey", response_model=SurveySubmitResponse)
async def submit_survey(
    slug: str,
    request: SurveySubmitRequest,
    auth=Depends(get_authenticated_client),
):
    """Submit a pre or post survey."""
    supabase, user = auth
    now = datetime.now(timezone.utc).isoformat()

    try:
        supabase.table("study_surveys") \
            .upsert({
                "study_slug": slug,
                "user_id": user["id"],
                "timing": request.timing,
                "responses": request.responses,
                "submitted_at": now,
            }) \
            .execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to save survey: {str(e)}")

    if request.timing == "post":
        supabase.table("study_enrollments") \
            .update({"completed_at": now}) \
            .eq("study_slug", slug) \
            .eq("user_id", user["id"]) \
            .execute()

    return SurveySubmitResponse(timing=request.timing, submitted_at=now)


@router.get("/{slug}/progress", response_model=ProgressResponse)
async def get_progress(slug: str, auth=Depends(get_authenticated_client)):
    """Get the user's progress in a study."""
    supabase, user = auth

    try:
        study_result = supabase.table("studies") \
            .select("config") \
            .eq("slug", slug) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail="Study not found")

    battery, _, _ = _parse_study_config(study_result.data.get("config", []))

    enrollment_result = supabase.table("study_enrollments") \
        .select("*") \
        .eq("study_slug", slug) \
        .eq("user_id", user["id"]) \
        .execute()

    if not enrollment_result.data:
        raise HTTPException(status_code=404, detail="Not enrolled in this study")

    enrollment = enrollment_result.data[0]

    surveys = supabase.table("study_surveys") \
        .select("timing") \
        .eq("study_slug", slug) \
        .eq("user_id", user["id"]) \
        .execute()
    survey_timings = {s["timing"] for s in (surveys.data or [])}

    # Get generative game scores
    games_result = supabase.table("games") \
        .select("id, game_number, game_type, sender_scores, status") \
        .eq("study_slug", slug) \
        .eq("sender_id", user["id"]) \
        .order("game_number") \
        .execute()

    game_scores = []
    for g in (games_result.data or []):
        scores = g.get("sender_scores") or {}
        game_scores.append({
            "game_id": g["id"],
            "item_number": g["game_number"],
            "game_type": g["game_type"],
            "status": g["status"],
            "scores": scores,
        })

    # Get evaluative scores
    evals_result = supabase.table("study_evaluations") \
        .select("item_number, task, response, feedback") \
        .eq("study_slug", slug) \
        .eq("user_id", user["id"]) \
        .order("item_number") \
        .execute()

    evaluation_scores = []
    for ev in (evals_result.data or []):
        evaluation_scores.append({
            "item_number": ev["item_number"],
            "task": ev["task"],
            "response": ev["response"],
            "feedback": ev.get("feedback"),
        })

    items_completed = enrollment.get("items_completed") or enrollment.get("games_completed", 0)

    return ProgressResponse(
        study_slug=slug,
        enrollment_id=enrollment["id"],
        items_completed=items_completed,
        total_items=len(battery),
        completed_at=enrollment.get("completed_at"),
        consented_at=enrollment.get("consented_at"),
        opted_partial=enrollment.get("opted_partial"),
        pre_survey_done="pre" in survey_timings,
        post_survey_done="post" in survey_timings,
        game_scores=game_scores,
        evaluation_scores=evaluation_scores,
    )


@router.post("/{slug}/next-item", response_model=NextItemResponse)
async def get_next_item(slug: str, auth=Depends(get_authenticated_client)):
    """Get the next item in the battery (generative or evaluative)."""
    supabase, user = auth

    try:
        study_result = supabase.table("studies") \
            .select("config") \
            .eq("slug", slug) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail="Study not found")

    battery, worked_example, optional_break = _parse_study_config(
        study_result.data.get("config", [])
    )

    enrollment_result = supabase.table("study_enrollments") \
        .select("*") \
        .eq("study_slug", slug) \
        .eq("user_id", user["id"]) \
        .execute()

    if not enrollment_result.data:
        raise HTTPException(status_code=404, detail="Not enrolled")

    enrollment = enrollment_result.data[0]
    items_completed = enrollment.get("items_completed") or enrollment.get("games_completed", 0)

    # Check for existing incomplete generative game (resume)
    incomplete = supabase.table("games") \
        .select("id, game_number, setup, game_type") \
        .eq("study_slug", slug) \
        .eq("sender_id", user["id"]) \
        .eq("status", "pending_clues") \
        .execute()

    if incomplete.data and len(incomplete.data) > 0:
        game = incomplete.data[0]
        game_number = game["game_number"]
        item_cfg = battery[game_number - 1]
        config = _battery_item_to_config(item_cfg)

        we = None
        if config.show_worked_example and worked_example:
            we = worked_example

        return NextItemResponse(
            game_id=game["id"],
            item_number=game_number,
            config=config,
            worked_example=we,
            resumed=True,
        )

    # Determine next item
    next_index = items_completed
    if next_index >= len(battery):
        raise HTTPException(status_code=400, detail="All items completed")

    item_cfg = battery[next_index]
    config = _battery_item_to_config(item_cfg)
    item_number = config.item_number

    # Check if we should show the optional break
    show_break = (optional_break is not None
                  and items_completed == optional_break
                  and enrollment.get("opted_partial") is None)

    we = None
    if config.show_worked_example and worked_example:
        we = worked_example

    if config.type == "evaluative":
        # Evaluative items: no games row, return stimulus
        stimulus = {}
        if config.task == "alignment_ranking":
            stimulus = {"stimulus_sets": config.stimulus_sets, "targets": config.targets}
        elif config.task == "parsimony_loo":
            stimulus = {"stimulus_set": config.stimulus_set, "targets": config.targets}
        elif config.task == "peer_rating":
            peer_data = await _get_peer_responses(
                supabase, slug, user["id"],
                config.source_item, item_cfg
            )
            stimulus = {
                "responses": peer_data["responses"],
                "targets": config.targets,
                "dimensions": config.dimensions,
                "is_preconstructed": peer_data["is_preconstructed"],
            }

        return NextItemResponse(
            game_id=None,
            item_number=item_number,
            config=config,
            worked_example=we,
            stimulus=stimulus,
            show_break=show_break,
            resumed=False,
        )

    # Generative items: create a games row
    task = config.task
    game_type = "radiation" if task in ("dat", "rat") else "bridging"

    setup = {
        "study_game_type": task,
        "m": config.m or 0,
        "n": config.n or 1,
        "targets": config.targets,
        "instructions": config.instructions,
    }
    if config.solution:
        setup["solution"] = config.solution

    game_id = str(uuid.uuid4())
    model_versions = await get_current_model_versions(supabase)
    supabase.table("games").insert({
        "id": game_id,
        "schema_version": 1,
        "instrument_id": "INS-001",
        "game_type": game_type,
        "sender_id": user["id"],
        "recipient_type": "llm",
        "embedding_model_id": model_versions.get("embedding_model_id"),
        "llm_model_id": model_versions.get("llm_model_id"),
        "scoring_version": model_versions.get("scoring_version"),
        "setup": setup,
        "status": "pending_clues",
        "study_slug": slug,
        "game_number": item_number,
    }).execute()

    return NextItemResponse(
        game_id=game_id,
        item_number=item_number,
        config=config,
        worked_example=we,
        show_break=show_break,
        resumed=False,
    )


# Keep old endpoint as alias
@router.post("/{slug}/next-game", response_model=NextItemResponse)
async def get_next_game(slug: str, auth=Depends(get_authenticated_client)):
    """Alias for next-item (backwards compatibility)."""
    return await get_next_item(slug, auth)


@router.post("/{slug}/games/{game_id}/submit", response_model=GameScoreResponse)
async def submit_game(
    slug: str,
    game_id: str,
    request: SubmitWordsRequest,
    auth=Depends(get_authenticated_client),
):
    """Submit words for a generative study item."""
    import numpy as np
    supabase, user = auth

    try:
        game_result = supabase.table("games") \
            .select("*") \
            .eq("id", game_id) \
            .eq("sender_id", user["id"]) \
            .eq("study_slug", slug) \
            .eq("status", "pending_clues") \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail="Game not found or already submitted")

    game = game_result.data
    setup = game.get("setup", {})
    study_game_type = setup.get("study_game_type", "bridge")
    targets = setup.get("targets", [])
    solution = setup.get("solution")
    item_number = game.get("game_number")

    words_clean = [w.lower().strip() for w in request.words if w.strip()]
    if not words_clean:
        raise HTTPException(status_code=400, detail="At least one word required")

    cache = EmbeddingCache.get_instance()
    word_embeddings_list = await cache.get_embeddings_batch(words_clean)
    word_embeddings = np.array(word_embeddings_list)

    scores = {}

    if study_game_type == "dat":
        scores = score_study_dat(word_embeddings)

    elif study_game_type == "rat":
        if not targets:
            raise HTTPException(status_code=400, detail="RAT game missing targets")
        target_emb_list = await cache.get_embeddings_batch(targets)
        target_embeddings = np.array(target_emb_list)
        scores = score_study_rat(
            target_embeddings,
            word_embeddings[0],
            solution=solution,
            submitted_word=words_clean[0],
        )

    elif study_game_type == "bridge":
        if not targets:
            raise HTTPException(status_code=400, detail="Bridge game missing targets")
        target_emb_list = await cache.get_embeddings_batch(targets)
        target_embeddings = np.array(target_emb_list)

        vocab_matrix = await _get_vocab_embeddings_matrix()
        m = len(targets)

        if vocab_matrix is not None:
            foil_sets = get_or_create_foil_sets(slug, m, vocab_matrix, k=100, seed=42)
            scores = score_study_bridge(
                target_embeddings, word_embeddings, foil_sets, vocab_matrix
            )
        else:
            scores = {"divergence": calculate_spread_clues_only(word_embeddings_list)}

    # Store results
    sender_input = {"clues": words_clean}
    if request.time_to_complete_ms is not None:
        sender_input["time_to_complete_ms"] = request.time_to_complete_ms

    now = datetime.now(timezone.utc).isoformat()
    update_data = {
        "sender_input": sender_input,
        "sender_scores": scores,
        "status": "completed",
        "completed_at": now,
        "auto_submitted": request.auto_submitted,
    }
    if request.time_to_complete_ms is not None:
        update_data["time_to_complete_ms"] = request.time_to_complete_ms

    supabase.table("games").update(update_data).eq("id", game_id).execute()

    _increment_items_completed(supabase, slug, user["id"])

    # Score comparison for paired items (9→2, 10→3)
    comparison = None
    paired_map = {9: 2, 10: 3}
    if item_number in paired_map:
        paired_item = paired_map[item_number]
        try:
            paired_result = supabase.table("games") \
                .select("sender_scores") \
                .eq("study_slug", slug) \
                .eq("sender_id", user["id"]) \
                .eq("game_number", paired_item) \
                .eq("status", "completed") \
                .single() \
                .execute()
            if paired_result.data and paired_result.data.get("sender_scores"):
                paired_scores = paired_result.data["sender_scores"]
                deltas = {}
                for metric in ["alignment", "divergence", "parsimony", "recovery_mrr"]:
                    if metric in scores and scores[metric] is not None and metric in paired_scores and paired_scores[metric] is not None:
                        deltas[metric] = round(scores[metric] - paired_scores[metric], 2)
                comparison = {
                    "paired_item": paired_item,
                    "paired_scores": paired_scores,
                    "deltas": deltas,
                }
        except Exception:
            pass

    percentiles = await _compute_percentiles(supabase, slug, item_number, scores, user["id"])

    return GameScoreResponse(
        game_id=game_id,
        item_number=item_number,
        game_type=study_game_type,
        scores=scores,
        percentiles=percentiles.get("percentiles") if percentiles else None,
        exact_match=scores.get("exact_match"),
        insufficient_data=percentiles.get("insufficient_data", False) if percentiles else True,
        comparison=comparison,
    )


@router.post("/{slug}/evaluations/{item_number}/submit", response_model=EvaluationScoreResponse)
async def submit_evaluation(
    slug: str,
    item_number: int,
    request: SubmitEvaluationRequest,
    auth=Depends(get_authenticated_client),
):
    """Submit an evaluative item response."""
    supabase, user = auth

    # Get study config to find this item
    try:
        study_result = supabase.table("studies") \
            .select("config") \
            .eq("slug", slug) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail="Study not found")

    battery, _, _ = _parse_study_config(study_result.data.get("config", []))

    item_cfg = None
    for item in battery:
        num = item.get("item_number", item.get("game_number"))
        if num == item_number:
            item_cfg = item
            break

    if not item_cfg or item_cfg.get("type") != "evaluative":
        raise HTTPException(status_code=400, detail="Item not found or not evaluative")

    task = item_cfg["task"]
    response_data = request.response
    feedback = {}
    correct = None

    if task == "alignment_ranking":
        ranking = response_data.get("ranking", [])
        if len(ranking) != 3:
            raise HTTPException(status_code=400, detail="Ranking must have 3 items")
        # Compare to pre-computed alignment ordering
        stimulus_sets = item_cfg.get("stimulus_sets", {})
        alignment_scores = {}
        for key, ss in stimulus_sets.items():
            alignment_scores[key] = ss.get("precomputed_alignment")
        # If pre-computed scores exist, determine correct order
        if all(v is not None for v in alignment_scores.values()):
            correct_order = sorted(alignment_scores.keys(), key=lambda k: alignment_scores[k], reverse=True)
            correct = ranking == correct_order
        feedback = {
            "alignment_scores": alignment_scores,
            "correct_order": correct_order if all(v is not None for v in alignment_scores.values()) else None,
            "participant_ranking": ranking,
        }

    elif task == "parsimony_loo":
        selected = response_data.get("selected_word") or response_data.get("selected")
        stimulus = item_cfg.get("stimulus_set", {})
        expected = stimulus.get("expected_redundant")
        correct = selected == expected if expected else None
        feedback = {
            "selected": selected,
            "expected_redundant": expected,
            "precomputed_deltas": stimulus.get("precomputed_deltas"),
        }

    elif task == "peer_rating":
        raw_ratings = response_data.get("ratings", {})
        # Normalize: frontend sends {0: {dim: val}, 1: {dim: val}} or [{dim: val}, ...]
        if isinstance(raw_ratings, dict):
            ratings_list = [raw_ratings[k] for k in sorted(raw_ratings.keys(), key=str)]
        else:
            ratings_list = raw_ratings
        if len(ratings_list) != 2:
            raise HTTPException(status_code=400, detail="Must rate exactly 2 responses")
        feedback = {
            "ratings_submitted": ratings_list,
            "metric_mapping": {
                "difference": "divergence",
                "connection": "alignment",
                "uniqueness": "parsimony",
            },
        }

    # Store evaluation
    stimulus_shown = response_data.get("stimulus_shown", {})
    try:
        eval_result = supabase.table("study_evaluations") \
            .upsert(
                {
                    "study_slug": slug,
                    "user_id": user["id"],
                    "item_number": item_number,
                    "task": task,
                    "stimulus": json.dumps(stimulus_shown) if isinstance(stimulus_shown, (dict, list)) else stimulus_shown,
                    "response": json.dumps(response_data) if isinstance(response_data, (dict, list)) else response_data,
                    "feedback": json.dumps(feedback) if isinstance(feedback, (dict, list)) else feedback,
                    "time_to_complete_ms": request.time_to_complete_ms,
                },
                on_conflict="study_slug,user_id,item_number",
            ) \
            .execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store evaluation: {str(e)}")

    # For peer_rating, also insert individual rating rows
    if task == "peer_rating" and eval_result.data:
        eval_id = eval_result.data[0]["id"]
        for idx, r in enumerate(ratings_list):
            rating_row = {
                "evaluation_id": eval_id,
                "response_index": idx,
                "difference": r.get("difference"),
                "connection": r.get("connection"),
                "uniqueness": r.get("uniqueness"),
                "is_preconstructed": True,  # Cold-start for now
            }
            try:
                supabase.table("peer_ratings").insert(rating_row).execute()
            except Exception:
                pass

    _increment_items_only(supabase, slug, user["id"])

    return EvaluationScoreResponse(
        item_number=item_number,
        task=task,
        feedback=feedback,
        correct=correct,
    )


@router.post("/{slug}/opt-partial")
async def opt_partial(slug: str, request: OptPartialRequest, auth=Depends(get_authenticated_client)):
    """Record participant's choice at the optional break point."""
    supabase, user = auth

    supabase.table("study_enrollments") \
        .update({"opted_partial": request.opted_partial}) \
        .eq("study_slug", slug) \
        .eq("user_id", user["id"]) \
        .execute()

    return {"opted_partial": request.opted_partial}


async def _compute_percentiles(
    supabase, slug: str, game_number: int, my_scores: dict, user_id: str
) -> dict:
    """Compute percentile rank within the study cohort for a specific game."""
    result = supabase.table("games") \
        .select("sender_scores") \
        .eq("study_slug", slug) \
        .eq("game_number", game_number) \
        .eq("status", "completed") \
        .execute()

    all_scores = [g["sender_scores"] for g in (result.data or []) if g.get("sender_scores")]

    if len(all_scores) < 20:
        return {"insufficient_data": True, "participant_count": len(all_scores)}

    percentiles = {}
    for metric in ["divergence", "alignment", "parsimony", "recovery_mrr"]:
        if metric not in my_scores or my_scores[metric] is None:
            continue
        my_val = my_scores[metric]
        all_vals = [s[metric] for s in all_scores if metric in s and s[metric] is not None]
        if not all_vals:
            continue
        count_below = sum(1 for v in all_vals if v <= my_val)
        percentiles[metric] = round(100 * count_below / len(all_vals), 1)

    return {"percentiles": percentiles, "insufficient_data": False, "participant_count": len(all_scores)}


@router.get("/my-completed", response_model=list[dict[str, str]])
async def get_my_completed_studies(auth=Depends(get_authenticated_client)):
    """Get list of studies the current user has completed."""
    supabase, user = auth

    result = supabase.table("study_enrollments") \
        .select("study_slug, completed_at") \
        .eq("user_id", user["id"]) \
        .not_.is_("completed_at", "null") \
        .order("completed_at", desc=True) \
        .execute()

    if not result.data:
        return []

    # Get study titles
    slugs = [r["study_slug"] for r in result.data]
    studies = supabase.table("studies") \
        .select("slug, title") \
        .in_("slug", slugs) \
        .execute()

    title_map = {s["slug"]: s["title"] for s in (studies.data or [])}

    return [
        {"study_slug": r["study_slug"], "study_title": title_map.get(r["study_slug"], r["study_slug"])}
        for r in result.data
    ]


@router.get("/{slug}/dashboard", response_model=DashboardData)
async def get_dashboard(slug: str, auth=Depends(get_authenticated_client)):
    """Get peer comparison dashboard data."""
    supabase, user = auth

    try:
        study_result = supabase.table("studies") \
            .select("title, config") \
            .eq("slug", slug) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail="Study not found")

    battery, _, _ = _parse_study_config(study_result.data.get("config", []))

    count_result = supabase.table("study_enrollments") \
        .select("id", count="exact") \
        .eq("study_slug", slug) \
        .not_.is_("completed_at", "null") \
        .execute()
    participant_count = count_result.count or 0
    insufficient = participant_count < 20

    all_games = supabase.table("games") \
        .select("sender_id, game_number, sender_scores, game_type") \
        .eq("study_slug", slug) \
        .eq("status", "completed") \
        .order("game_number") \
        .execute()

    my_games = [g for g in (all_games.data or []) if g["sender_id"] == user["id"]]

    # Build per-game scores
    per_game_scores = []
    for g in my_games:
        scores = g.get("sender_scores") or {}
        item_num = g["game_number"]
        item_cfg = battery[item_num - 1] if item_num <= len(battery) else {}
        entry = {
            "item_number": item_num,
            "game_type": item_cfg.get("task", item_cfg.get("type", g.get("game_type", ""))),
            "m": item_cfg.get("m"),
            "n": item_cfg.get("n"),
            "scores": scores,
        }

        if not insufficient:
            same_game = [
                gg["sender_scores"] for gg in (all_games.data or [])
                if gg["game_number"] == item_num and gg.get("sender_scores")
            ]
            pcts = {}
            for metric in ["divergence", "alignment", "parsimony", "recovery_mrr"]:
                if metric not in scores or scores[metric] is None:
                    continue
                vals = [s[metric] for s in same_game if metric in s and s[metric] is not None]
                if vals:
                    count_below = sum(1 for v in vals if v <= scores[metric])
                    pcts[metric] = round(100 * count_below / len(vals), 1)
            entry["percentiles"] = pcts

        per_game_scores.append(entry)

    # Aggregate percentiles
    aggregate_percentiles = None
    if not insufficient and per_game_scores:
        agg = {}
        for metric in ["divergence", "alignment", "parsimony"]:
            vals = [
                g["percentiles"][metric]
                for g in per_game_scores
                if "percentiles" in g and metric in g.get("percentiles", {})
            ]
            if vals:
                agg[metric] = round(sum(vals) / len(vals), 1)
        aggregate_percentiles = agg if agg else None

    # Scatterplot data
    scatterplot_data = None
    if not insufficient:
        scatter = []
        for g in (all_games.data or []):
            scores = g.get("sender_scores") or {}
            if "divergence" in scores and "alignment" in scores:
                scatter.append({
                    "sender_id": g["sender_id"],
                    "item_number": g["game_number"],
                    "divergence": scores["divergence"],
                    "alignment": scores["alignment"],
                    "parsimony": scores.get("parsimony"),
                    "is_current_user": g["sender_id"] == user["id"],
                })
        scatterplot_data = scatter if scatter else None

    # Learning curve
    learning_curve = None
    if not insufficient and per_game_scores:
        curve = []
        for g in per_game_scores:
            if "percentiles" in g:
                curve.append({
                    "item_number": g["item_number"],
                    "game_type": g["game_type"],
                    **{f"{m}_percentile": g["percentiles"].get(m) for m in ["divergence", "alignment", "parsimony"]},
                })
        learning_curve = curve if curve else None

    # Comparison charts (item 3 vs 10, item 4 vs 8)
    comparison_charts = None
    my_scores_by_item = {g["item_number"]: g["scores"] for g in per_game_scores}
    comparisons = []
    for earlier, later, label in [(3, 10, "Bridge (5,5) retest"), (4, 8, "Asymmetric comparison")]:
        if earlier in my_scores_by_item and later in my_scores_by_item:
            comparisons.append({
                "label": label,
                "earlier": {"item_number": earlier, "scores": my_scores_by_item[earlier]},
                "later": {"item_number": later, "scores": my_scores_by_item[later]},
            })
    if comparisons:
        comparison_charts = comparisons

    # Peer feedback for user's item 3 response
    peer_feedback = None
    try:
        my_item3 = supabase.table("games") \
            .select("id") \
            .eq("study_slug", slug) \
            .eq("sender_id", user["id"]) \
            .eq("game_number", 3) \
            .eq("status", "completed") \
            .execute()
        if my_item3.data:
            game_id = my_item3.data[0]["id"]
            ratings = supabase.table("peer_ratings") \
                .select("difference, connection, uniqueness") \
                .eq("rated_game_id", game_id) \
                .execute()
            if ratings.data and len(ratings.data) >= 3:
                n = len(ratings.data)
                peer_feedback = {
                    "game_id": game_id,
                    "item_number": 3,
                    "rating_count": n,
                    "mean_difference": round(sum(r["difference"] for r in ratings.data) / n, 1),
                    "mean_connection": round(sum(r["connection"] for r in ratings.data) / n, 1),
                    "mean_uniqueness": round(sum(r["uniqueness"] for r in ratings.data) / n, 1),
                }
    except Exception:
        pass

    return DashboardData(
        study_slug=slug,
        study_title=study_result.data["title"],
        participant_count=participant_count,
        insufficient_data=insufficient,
        aggregate_percentiles=aggregate_percentiles,
        per_game_scores=per_game_scores,
        scatterplot_data=scatterplot_data,
        learning_curve=learning_curve,
        comparison_charts=comparison_charts,
        peer_feedback=peer_feedback,
    )


@router.get("/{slug}/survey/{timing}")
async def get_survey_items(slug: str, timing: str, auth=Depends(get_optional_client)):
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
