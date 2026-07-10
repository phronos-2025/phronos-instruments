"""
Participant Routes - INS-001 Semantic Associations

Kept at the /users prefix for URL compatibility, but there are no accounts:
"me" is the caller's participant. Computed fields come from the
participant_profiles VIEW.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from app.models import (
    UserResponse,
    ProfileResponse,
    AcceptTermsRequest,
    GameHistoryItem,
    GameHistoryResponse,
)
from app.middleware.participant import get_participant
from app.services.profiles import get_user_profile
from app.config import PROFILE_THRESHOLD_GAMES

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user(auth=Depends(get_participant)):
    """
    Current participant info. games_played / profile_ready come from the
    participant_profiles VIEW; there is no display name or email.
    """
    supabase, participant_id = auth

    # Participant row is optional (only created on terms acceptance).
    try:
        p = supabase.table("participants") \
            .select("created_at, terms_accepted_at") \
            .eq("id", participant_id) \
            .single() \
            .execute()
        prow = p.data or {}
    except Exception:
        prow = {}

    try:
        profile = supabase.table("participant_profiles") \
            .select("games_played, profile_ready") \
            .eq("user_id", participant_id) \
            .single() \
            .execute()
        pf = profile.data or {}
    except Exception:
        pf = {}

    return UserResponse(
        user_id=participant_id,
        display_name=None,
        is_anonymous=True,
        email=None,
        games_played=pf.get("games_played", 0) or 0,
        profile_ready=pf.get("profile_ready", False) or False,
        terms_accepted_at=prow.get("terms_accepted_at"),
        created_at=prow.get("created_at"),
    )


@router.get("/me/profile", response_model=ProfileResponse)
async def get_profile(auth=Depends(get_participant)):
    """Participant's cognitive profile, computed from participant_profiles."""
    supabase, participant_id = auth

    profile = await get_user_profile(supabase, participant_id)

    if profile is None:
        # No completed games yet — return an empty profile.
        return ProfileResponse(
            user_id=participant_id,
            games_played=0,
            divergence_mean=None,
            divergence_std=None,
            divergence_n=0,
            network_convergence_mean=None,
            network_games=0,
            stranger_convergence_mean=None,
            stranger_games=0,
            llm_convergence_mean=None,
            llm_games=0,
            radiation_games=0,
            bridging_games=0,
            semantic_portability=None,
            consistency_score=None,
            archetype=None,
            profile_ready=False,
            games_until_ready=PROFILE_THRESHOLD_GAMES,
        )

    return profile


@router.post("/me/accept-terms")
async def accept_terms(request: AcceptTermsRequest, auth=Depends(get_participant)):
    """Record terms acceptance by upserting the participant row."""
    supabase, participant_id = auth

    if not request.accepted:
        raise HTTPException(status_code=400, detail={"error": "Terms must be accepted"})

    supabase.table("participants").upsert(
        {"id": participant_id, "terms_accepted_at": "now()"}
    ).execute()

    return {"accepted": True}


@router.get("/me/games", response_model=GameHistoryResponse)
async def get_game_history(
    auth=Depends(get_participant),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Paginated history of games this participant created (as sender)."""
    supabase, participant_id = auth

    count_result = supabase.table("games") \
        .select("id", count="exact") \
        .eq("sender_id", participant_id) \
        .execute()
    total = count_result.count or 0

    games_result = supabase.table("games") \
        .select("id, game_type, setup, sender_scores, status, created_at, completed_at, study_slug, game_number") \
        .eq("sender_id", participant_id) \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1) \
        .execute()

    games = []
    for g in games_result.data or []:
        setup = g.get("setup") or {}
        scores = g.get("sender_scores") or {}
        games.append(GameHistoryItem(
            game_id=g["id"],
            game_type=g["game_type"],
            seed_word=setup.get("seed_word"),
            anchor_word=setup.get("anchor_word"),
            target_word=setup.get("target_word"),
            divergence=scores.get("divergence"),
            relevance=scores.get("relevance"),
            convergence=scores.get("convergence"),
            alignment=scores.get("alignment_display", scores.get("alignment")),
            parsimony=scores.get("parsimony"),
            recovery_mrr=scores.get("recovery_mrr"),
            status=g["status"],
            created_at=g["created_at"],
            completed_at=g.get("completed_at"),
            study_slug=g.get("study_slug"),
            game_number=g.get("game_number"),
            study_game_type=setup.get("study_game_type"),
            targets=setup.get("targets"),
            n=setup.get("n"),
        ))

    return GameHistoryResponse(games=games, total=total, limit=limit, offset=offset)
