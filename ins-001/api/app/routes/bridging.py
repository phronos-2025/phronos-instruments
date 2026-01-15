"""
Bridging Routes - INS-001.2 Semantic Bridging

Schema Version: 2.0 - Routes forward to unified games router.

This file maintains backwards compatibility for the /api/v1/bridging/* endpoints.
All bridging functionality is now handled by the unified games table.
"""

import random
from fastapi import APIRouter, HTTPException, Depends, Query
from app.models import (
    CreateBridgingGameRequest, CreateBridgingGameResponse,
    SubmitBridgingCluesRequest, SubmitBridgingCluesResponse,
    SubmitBridgingBridgeRequest, SubmitBridgingBridgeResponse,
    BridgingGameResponse, GameStatus, RecipientType,
    SuggestWordResponse,
    ErrorResponse,
)
from app.middleware.auth import get_authenticated_client
from app.routes.games import (
    create_bridging_game as games_create_bridging,
    get_bridging_game as games_get_bridging,
    submit_bridging_clues as games_submit_clues,
    submit_bridging_bridge as games_submit_bridge,
)
from app.services.cache import VocabularyPool
from app.services.scoring import cosine_similarity

router = APIRouter()


# ============================================
# FORWARDED ROUTES (to unified games router)
# ============================================

@router.post("/", response_model=CreateBridgingGameResponse)
async def create_bridging_game(
    request: CreateBridgingGameRequest,
    auth = Depends(get_authenticated_client)
):
    """Create a new bridging game."""
    return await games_create_bridging(request, auth)


@router.get("/{game_id}", response_model=BridgingGameResponse)
async def get_bridging_game(
    game_id: str,
    auth = Depends(get_authenticated_client)
):
    """Get bridging game details."""
    return await games_get_bridging(game_id, auth)


@router.post("/{game_id}/clues", response_model=SubmitBridgingCluesResponse)
async def submit_bridging_clues(
    game_id: str,
    request: SubmitBridgingCluesRequest,
    auth = Depends(get_authenticated_client)
):
    """Submit clues for a bridging game."""
    return await games_submit_clues(game_id, request, auth)


@router.post("/{game_id}/bridge", response_model=SubmitBridgingBridgeResponse)
async def submit_bridging_bridge(
    game_id: str,
    request: SubmitBridgingBridgeRequest,
    auth = Depends(get_authenticated_client)
):
    """Submit recipient's bridge (V2: bridge-vs-bridge)."""
    return await games_submit_bridge(game_id, request, auth)


# ============================================
# UTILITY ROUTES (not in games router)
# ============================================

@router.get("/suggest", response_model=SuggestWordResponse)
async def suggest_distant_word(
    from_word: str = Query(default=None, max_length=50),
    attempt: int = Query(default=1, ge=1, le=100),
    auth = Depends(get_authenticated_client)
):
    """
    Suggest a random word from vocabulary.

    Uses in-memory vocabulary pool for instant response (<50ms).
    """
    supabase, user = auth

    # Use in-memory vocabulary pool for instant response
    pool = VocabularyPool.get_instance()
    if pool.is_initialized and pool.size > 0:
        word = pool.get_random()
        if word:
            return SuggestWordResponse(
                suggestion=word,
                from_word=from_word.lower().strip() if from_word else None
            )

    # Fallback: database query if pool not initialized
    try:
        random_offset = random.randint(0, 29999)  # 30k vocabulary
        result = supabase.table("vocabulary_embeddings") \
            .select("word") \
            .range(random_offset, random_offset) \
            .execute()
        if result.data:
            word = result.data[0]["word"]
            return SuggestWordResponse(
                suggestion=word,
                from_word=from_word.lower().strip() if from_word else None
            )
    except Exception as e:
        print(f"suggest_distant_word database error: {e}")

    # Hardcoded fallback
    fallback_words = ["ocean", "mountain", "whisper", "thunder", "crystal", "shadow"]
    return SuggestWordResponse(
        suggestion=random.choice(fallback_words),
        from_word=from_word.lower().strip() if from_word else None
    )


@router.get("/distance")
async def get_semantic_distance(
    anchor: str = Query(min_length=1, max_length=50),
    target: str = Query(min_length=1, max_length=50),
    auth = Depends(get_authenticated_client)
):
    """
    Get semantic distance (spread) between two words using DAT-style scoring.

    Distance is 0-100 scale (DAT convention): cosine distance x 100.
    """
    anchor_clean = anchor.lower().strip()
    target_clean = target.lower().strip()

    if anchor_clean == target_clean:
        return {
            "anchor": anchor_clean,
            "target": target_clean,
            "distance": 0.0,
            "interpretation": "identical"
        }

    try:
        from app.services.cache import EmbeddingCache
        cache = EmbeddingCache.get_instance()
        embeddings = await cache.get_embeddings_batch([anchor_clean, target_clean])

        sim = cosine_similarity(embeddings[0], embeddings[1])
        distance = (1 - sim) * 100

        if distance < 50:
            interpretation = "close"
        elif distance < 75:
            interpretation = "below average"
        elif distance < 85:
            interpretation = "average"
        elif distance < 95:
            interpretation = "above average"
        else:
            interpretation = "distant"

        return {
            "anchor": anchor_clean,
            "target": target_clean,
            "distance": distance,
            "interpretation": interpretation
        }

    except Exception as e:
        print(f"get_semantic_distance error: {e}")
        return {
            "anchor": anchor_clean,
            "target": target_clean,
            "distance": 78.0,
            "interpretation": "average"
        }
