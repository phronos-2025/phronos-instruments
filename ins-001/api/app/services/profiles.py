"""
Profile Computation Service - INS-001 Semantic Associations

Computes user cognitive profiles from completed games.
Called synchronously after game completion.
"""

from typing import Optional
from supabase import Client
from app.services.scoring import (
    compute_semantic_portability,
    compute_consistency,
    classify_archetype
)


async def update_user_profile(supabase_service: Client, user_id: str):
    """
    Recompute user profile aggregates from completed games.
    
    This function:
    1. Queries all completed games for the user (as sender or recipient)
    2. Computes means, std dev, and counts for each metric
    3. Computes derived metrics (semantic portability, consistency, archetype)
    4. Upserts into user_profiles table
    
    Args:
        supabase_service: Service key client (for cross-user access)
        user_id: User ID to compute profile for
    """
    # Get all completed games where user is sender or recipient
    games_result = supabase_service.table("games") \
        .select("divergence_score, convergence_score, recipient_type, sender_id, recipient_id") \
        .or_(f"sender_id.eq.{user_id},recipient_id.eq.{user_id}") \
        .eq("status", "completed") \
        .not_.is_("divergence_score", "null") \
        .execute()
    
    games = games_result.data or []
    
    if not games:
        # No games yet - create empty profile
        supabase_service.table("user_profiles").upsert({
            "user_id": user_id,
            "divergence_n": 0,
            "network_convergence_n": 0,
            "stranger_convergence_n": 0,
            "llm_convergence_n": 0,
        }, on_conflict="user_id").execute()
        return
    
    # Separate games by type
    divergence_scores = []
    network_convergence = []
    stranger_convergence = []
    llm_convergence = []
    
    for game in games:
        # Divergence: only for games where user is sender
        if game["sender_id"] == user_id and game.get("divergence_score") is not None:
            divergence_scores.append(game["divergence_score"])
        
        # Convergence: only for games where user is recipient
        if game["recipient_id"] == user_id and game.get("convergence_score") is not None:
            recipient_type = game.get("recipient_type", "")
            if recipient_type == "network":
                network_convergence.append(game["convergence_score"])
            elif recipient_type == "stranger":
                stranger_convergence.append(game["convergence_score"])
            elif recipient_type == "llm":
                llm_convergence.append(game["convergence_score"])
    
    # Compute statistics
    import numpy as np
    
    divergence_mean = float(np.mean(divergence_scores)) if divergence_scores else None
    divergence_std = float(np.std(divergence_scores)) if divergence_scores else None
    divergence_n = len(divergence_scores)
    
    network_convergence_mean = float(np.mean(network_convergence)) if network_convergence else None
    network_convergence_n = len(network_convergence)
    
    stranger_convergence_mean = float(np.mean(stranger_convergence)) if stranger_convergence else None
    stranger_convergence_n = len(stranger_convergence)
    
    llm_convergence_mean = float(np.mean(llm_convergence)) if llm_convergence else None
    llm_convergence_n = len(llm_convergence)
    
    # Compute derived metrics
    semantic_portability = compute_semantic_portability(
        network_convergence_mean,
        stranger_convergence_mean
    )
    
    consistency_score = compute_consistency(
        divergence_mean,
        divergence_std
    )
    
    # Classify archetype (use means, default to 0.5 if None)
    archetype = None
    if divergence_mean is not None and network_convergence_mean is not None and \
       stranger_convergence_mean is not None and llm_convergence_mean is not None:
        archetype = classify_archetype(
            divergence_mean,
            network_convergence_mean or 0.0,
            stranger_convergence_mean or 0.0,
            llm_convergence_mean or 0.0
        )
    
    # Upsert profile
    profile_data = {
        "user_id": user_id,
        "divergence_mean": divergence_mean,
        "divergence_std": divergence_std,
        "divergence_n": divergence_n,
        "network_convergence_mean": network_convergence_mean,
        "network_convergence_n": network_convergence_n,
        "stranger_convergence_mean": stranger_convergence_mean,
        "stranger_convergence_n": stranger_convergence_n,
        "llm_convergence_mean": llm_convergence_mean,
        "llm_convergence_n": llm_convergence_n,
        "semantic_portability": semantic_portability,
        "consistency_score": consistency_score,
        "archetype": archetype,
    }
    
    supabase_service.table("user_profiles").upsert(
        profile_data,
        on_conflict="user_id"
    ).execute()
    
    # Update user.games_played and profile_ready
    total_games = divergence_n + network_convergence_n + stranger_convergence_n + llm_convergence_n
    from app.config import PROFILE_THRESHOLD_GAMES
    profile_ready = total_games >= PROFILE_THRESHOLD_GAMES
    
    supabase_service.table("users").update({
        "games_played": total_games,
        "profile_ready": profile_ready
    }).eq("id", user_id).execute()
