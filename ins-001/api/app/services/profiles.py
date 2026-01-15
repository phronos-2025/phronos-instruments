"""
Profile Service - INS-001 Semantic Associations

Schema Version: 2.0 - Profiles are computed via database VIEW.

The user_profiles view computes all profile metrics on-demand from the games
table. This eliminates staleness and simplifies the codebase. No need to
manually trigger profile updates after game completion.
"""

from typing import Optional
from supabase import Client
from app.models import ProfileResponse


async def get_user_profile(supabase: Client, user_id: str) -> Optional[ProfileResponse]:
    """
    Get user profile from the computed view.

    The user_profiles view automatically computes:
    - games_played
    - divergence stats (mean, std, n)
    - convergence by recipient type
    - derived metrics (semantic_portability, consistency_score, archetype)
    - profile_ready status

    Args:
        supabase: Supabase client
        user_id: User ID to get profile for

    Returns:
        ProfileResponse or None if user not found
    """
    result = supabase.table("user_profiles") \
        .select("*") \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not result.data:
        return None

    profile = result.data
    games_played = profile.get("games_played", 0) or 0

    # Calculate games until ready
    from app.config import PROFILE_THRESHOLD_GAMES
    games_until_ready = max(0, PROFILE_THRESHOLD_GAMES - games_played)

    return ProfileResponse(
        user_id=profile["user_id"],
        games_played=games_played,
        divergence_mean=profile.get("divergence_mean"),
        divergence_std=profile.get("divergence_std"),
        divergence_n=profile.get("divergence_n", 0) or 0,
        network_convergence_mean=profile.get("network_convergence_mean"),
        network_games=profile.get("network_games", 0) or 0,
        stranger_convergence_mean=profile.get("stranger_convergence_mean"),
        stranger_games=profile.get("stranger_games", 0) or 0,
        llm_convergence_mean=profile.get("llm_convergence_mean"),
        llm_games=profile.get("llm_games", 0) or 0,
        radiation_games=profile.get("radiation_games", 0) or 0,
        bridging_games=profile.get("bridging_games", 0) or 0,
        semantic_portability=profile.get("semantic_portability"),
        consistency_score=profile.get("consistency_score"),
        archetype=profile.get("archetype"),
        profile_ready=profile.get("profile_ready", False) or False,
        games_until_ready=games_until_ready
    )


async def update_user_profile(supabase_service: Client, user_id: str):
    """
    DEPRECATED: No-op in Schema v2.

    User profiles are now computed on-demand via the user_profiles VIEW.
    This function is kept for backwards compatibility but does nothing.

    Args:
        supabase_service: Service key client (ignored)
        user_id: User ID (ignored)
    """
    # No-op: profiles are computed via VIEW
    pass
