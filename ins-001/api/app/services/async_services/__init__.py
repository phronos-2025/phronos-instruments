"""
Async Services - Background Processing Components

This module provides async/background processing infrastructure for INS-001.

Components:
- EagerPrecompute: Triggers heavy computation when user starts a task,
  so results are ready before they need them.

Usage:
    from app.services.async_services import EagerPrecompute

    # On game creation, start precomputation
    precompute = EagerPrecompute.get_instance()
    await precompute.start_bridging_precompute(
        game_id=game_id,
        anchor=anchor,
        target=target,
        recipient_type=recipient_type,
        supabase=supabase
    )

    # On clue submission, get precomputed results
    results = await precompute.get_precomputed_results(game_id)
"""

from app.services.async_services.eager_precompute import EagerPrecompute

__all__ = ["EagerPrecompute"]
