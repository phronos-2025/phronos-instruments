"""
Users Routes - INS-001 Semantic Associations

Schema Version: 2.0 - Uses user_profiles VIEW for computed fields.

Handles user info and profile endpoints.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from postgrest.exceptions import APIError
from app.models import (
    UserResponse,
    ProfileResponse,
    AcceptTermsRequest,
    TransferGamesRequest,
    TransferGamesResponse,
    GameHistoryItem,
    GameHistoryResponse,
    ErrorResponse
)
from app.middleware.auth import get_authenticated_client
from app.services.profiles import get_user_profile
from app.config import PROFILE_THRESHOLD_GAMES

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    auth = Depends(get_authenticated_client)
):
    """
    Get current user info.

    games_played and profile_ready are computed from the user_profiles VIEW.
    """
    supabase, user = auth

    # Get base user data
    try:
        user_result = supabase.table("users") \
            .select("*") \
            .eq("id", user["id"]) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail={"error": "User not found"})

    if not user_result.data:
        raise HTTPException(status_code=404, detail={"error": "User not found"})

    u = user_result.data

    # Get computed fields from profile view
    try:
        profile_result = supabase.table("user_profiles") \
            .select("games_played, profile_ready") \
            .eq("user_id", user["id"]) \
            .single() \
            .execute()
        profile = profile_result.data or {}
    except APIError:
        profile = {}

    return UserResponse(
        user_id=u["id"],
        display_name=u.get("display_name"),
        is_anonymous=u["is_anonymous"],
        email=user.get("email"),
        games_played=profile.get("games_played", 0) or 0,
        profile_ready=profile.get("profile_ready", False) or False,
        terms_accepted_at=u.get("terms_accepted_at"),
        created_at=u["created_at"]
    )


@router.get("/me/profile", response_model=ProfileResponse)
async def get_profile(
    auth = Depends(get_authenticated_client)
):
    """
    Get user's cognitive profile.

    All profile data is computed from the user_profiles VIEW.
    """
    supabase, user = auth

    profile = await get_user_profile(supabase, user["id"])

    if profile is None:
        # Return empty profile for new users
        return ProfileResponse(
            user_id=user["id"],
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
            games_until_ready=PROFILE_THRESHOLD_GAMES
        )

    return profile


@router.post("/me/accept-terms")
async def accept_terms(
    request: AcceptTermsRequest,
    auth = Depends(get_authenticated_client)
):
    """Accept terms (for anonymous users)."""
    supabase, user = auth

    if not request.accepted:
        raise HTTPException(
            status_code=400,
            detail={"error": "Terms must be accepted"}
        )

    supabase.table("users") \
        .update({"terms_accepted_at": "now()"}) \
        .eq("id", user["id"]) \
        .execute()

    return {"accepted": True}


@router.get("/me/games", response_model=GameHistoryResponse)
async def get_game_history(
    auth = Depends(get_authenticated_client),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0)
):
    """
    Get user's game history.

    Returns paginated list of games the user has played (as sender).
    """
    supabase, user = auth

    # Get total count
    count_result = supabase.table("games") \
        .select("id", count="exact") \
        .eq("sender_id", user["id"]) \
        .execute()
    total = count_result.count or 0

    # Get games with pagination
    games_result = supabase.table("games") \
        .select("id, game_type, setup, sender_scores, status, created_at, completed_at") \
        .eq("sender_id", user["id"]) \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1) \
        .execute()

    games = []
    for g in games_result.data or []:
        setup = g.get("setup") or {}
        scores = g.get("sender_scores") or {}

        item = GameHistoryItem(
            game_id=g["id"],
            game_type=g["game_type"],
            seed_word=setup.get("seed_word"),
            anchor_word=setup.get("anchor_word"),
            target_word=setup.get("target_word"),
            divergence=scores.get("divergence"),
            relevance=scores.get("relevance"),
            convergence=scores.get("convergence"),
            status=g["status"],
            created_at=g["created_at"],
            completed_at=g.get("completed_at")
        )
        games.append(item)

    return GameHistoryResponse(
        games=games,
        total=total,
        limit=limit,
        offset=offset
    )


@router.post("/me/transfer-games", response_model=TransferGamesResponse)
async def transfer_games_from_anonymous(
    request: TransferGamesRequest,
    auth = Depends(get_authenticated_client)
):
    """
    Transfer games from an anonymous session to the current authenticated user.

    This is used when a user plays games anonymously, then signs in to an existing
    account. The games created under the anonymous session are transferred to
    their authenticated account.

    Security: Only transfers games where sender_id matches the anonymous_user_id
    AND that anonymous user actually exists and is anonymous.
    """
    supabase, user = auth

    anonymous_user_id = request.anonymous_user_id
    print(f"transfer_games: Attempting to transfer from {anonymous_user_id} to {user['id']}")

    # Don't allow transferring to yourself
    if anonymous_user_id == user["id"]:
        print(f"transfer_games: Rejected - same user ID")
        return TransferGamesResponse(
            transferred_count=0,
            message="Cannot transfer games from your own account"
        )

    # Verify the anonymous user exists and is actually anonymous
    try:
        anon_user_result = supabase.table("users") \
            .select("id, is_anonymous") \
            .eq("id", anonymous_user_id) \
            .single() \
            .execute()

        if not anon_user_result.data:
            print(f"transfer_games: Anonymous user {anonymous_user_id} not found in users table")
            return TransferGamesResponse(
                transferred_count=0,
                message="Anonymous session not found"
            )

        print(f"transfer_games: Found user, is_anonymous = {anon_user_result.data.get('is_anonymous')}")

        if not anon_user_result.data.get("is_anonymous", False):
            print(f"transfer_games: Rejected - user {anonymous_user_id} is not anonymous")
            return TransferGamesResponse(
                transferred_count=0,
                message="Cannot transfer games from a registered account"
            )

    except APIError:
        return TransferGamesResponse(
            transferred_count=0,
            message="Anonymous session not found"
        )

    # Transfer all games where sender_id is the anonymous user
    try:
        # First count how many games will be transferred
        count_result = supabase.table("games") \
            .select("id", count="exact") \
            .eq("sender_id", anonymous_user_id) \
            .execute()

        games_count = count_result.count or 0
        print(f"transfer_games: Found {games_count} games to transfer from {anonymous_user_id}")

        if games_count == 0:
            return TransferGamesResponse(
                transferred_count=0,
                message="No games to transfer"
            )

        # Update all games to new owner
        update_result = supabase.table("games") \
            .update({"sender_id": user["id"]}) \
            .eq("sender_id", anonymous_user_id) \
            .execute()
        print(f"transfer_games: Update result = {update_result.data}")

        return TransferGamesResponse(
            transferred_count=games_count,
            message=f"Successfully transferred {games_count} game(s) to your account"
        )

    except Exception as e:
        print(f"transfer_games_from_anonymous error: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to transfer games", "detail": str(e)}
        )
