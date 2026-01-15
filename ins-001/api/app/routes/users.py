"""
Users Routes - INS-001 Semantic Associations

Schema Version: 2.0 - Uses user_profiles VIEW for computed fields.

Handles user info and profile endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from postgrest.exceptions import APIError
from app.models import (
    UserResponse,
    ProfileResponse,
    AcceptTermsRequest,
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
        games_played=profile.get("games_played", 0) or 0,
        profile_ready=profile.get("profile_ready", False) or False,
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
