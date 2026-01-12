"""
Users Routes - INS-001 Semantic Associations

Handles user info and profile endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from app.models import (
    UserResponse,
    ProfileResponse,
    AcceptTermsRequest,
    ErrorResponse
)
from app.middleware.auth import get_authenticated_client
from app.config import PROFILE_THRESHOLD_GAMES

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    auth = Depends(get_authenticated_client)
):
    """Get current user info."""
    supabase, user = auth
    
    result = supabase.table("users") \
        .select("*") \
        .eq("id", user["id"]) \
        .single() \
        .execute()
    
    if not result.data:
        raise HTTPException(
            status_code=404,
            detail={"error": "User not found"}
        )
    
    u = result.data
    return UserResponse(
        user_id=u["id"],
        display_name=u.get("display_name"),
        is_anonymous=u["is_anonymous"],
        games_played=u.get("games_played", 0),
        profile_ready=u.get("profile_ready", False),
        created_at=u["created_at"]
    )


@router.get("/me/profile", response_model=ProfileResponse)
async def get_profile(
    auth = Depends(get_authenticated_client)
):
    """Get user's cognitive profile."""
    supabase, user = auth
    
    result = supabase.table("user_profiles") \
        .select("*") \
        .eq("user_id", user["id"]) \
        .single() \
        .execute()
    
    # Calculate games until ready
    profile = result.data or {}
    total_games = (
        (profile.get("divergence_n") or 0) +
        (profile.get("network_convergence_n") or 0) +
        (profile.get("stranger_convergence_n") or 0) +
        (profile.get("llm_convergence_n") or 0)
    )
    games_until_ready = max(0, PROFILE_THRESHOLD_GAMES - total_games)
    
    return ProfileResponse(
        user_id=user["id"],
        divergence_mean=profile.get("divergence_mean"),
        divergence_std=profile.get("divergence_std"),
        divergence_n=profile.get("divergence_n", 0),
        network_convergence_mean=profile.get("network_convergence_mean"),
        network_convergence_n=profile.get("network_convergence_n", 0),
        stranger_convergence_mean=profile.get("stranger_convergence_mean"),
        stranger_convergence_n=profile.get("stranger_convergence_n", 0),
        llm_convergence_mean=profile.get("llm_convergence_mean"),
        llm_convergence_n=profile.get("llm_convergence_n", 0),
        semantic_portability=profile.get("semantic_portability"),
        consistency_score=profile.get("consistency_score"),
        archetype=profile.get("archetype"),
        profile_ready=games_until_ready == 0,
        games_until_ready=games_until_ready
    )


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
