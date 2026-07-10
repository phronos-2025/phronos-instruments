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
    SuggestWordResponse, CreateBridgingShareResponse,
    JoinBridgingGameResponseV2,
    ErrorResponse,
)
from app.middleware.participant import get_participant
from app.routes.games import (
    create_bridging_game as games_create_bridging,
    get_bridging_game as games_get_bridging,
    submit_bridging_clues as games_submit_clues,
)
from app.services.cache import VocabularyPool
from app.services.scoring import cosine_similarity

router = APIRouter()


# ============================================
# UTILITY ROUTES (must be defined BEFORE parameterized routes)
# ============================================

@router.get("/suggest", response_model=SuggestWordResponse)
async def suggest_distant_word(
    from_word: str = Query(default=None, max_length=50),
    attempt: int = Query(default=1, ge=1, le=100),
    auth = Depends(get_participant)
):
    """
    Suggest a random word from vocabulary.

    If from_word is provided (INS-001.2), suggests a semantically distant word
    by sampling candidates and picking the most distant one.

    Uses in-memory vocabulary pool for instant response (<100ms).
    """
    supabase, participant_id = auth
    from_word_clean = from_word.lower().strip() if from_word else None

    pool = VocabularyPool.get_instance()

    # INS-001.2: When from_word is provided, find a semantically distant word
    if from_word_clean and pool.is_initialized and pool.size > 0:
        try:
            from app.services.cache import EmbeddingCache
            cache = EmbeddingCache.get_instance()

            # Sample 10 random candidates
            candidates = pool.get_random_batch(10, allow_duplicates=False)
            # Filter out the from_word itself
            candidates = [c for c in candidates if c != from_word_clean]

            if candidates:
                # Get embeddings for from_word + all candidates in one batch
                all_words = [from_word_clean] + candidates
                embeddings = await cache.get_embeddings_batch(all_words)

                from_embedding = embeddings[0]
                candidate_embeddings = embeddings[1:]

                # Find the most distant candidate (lowest similarity)
                best_word = candidates[0]
                best_distance = -1.0

                for word, emb in zip(candidates, candidate_embeddings):
                    sim = cosine_similarity(from_embedding, emb)
                    distance = 1 - sim
                    if distance > best_distance:
                        best_distance = distance
                        best_word = word

                return SuggestWordResponse(
                    suggestion=best_word,
                    from_word=from_word_clean
                )
        except Exception as e:
            print(f"suggest_distant_word semantic filtering error: {e}")
            # Fall through to simple random

    # INS-001.1 or fallback: Simple random word
    if pool.is_initialized and pool.size > 0:
        word = pool.get_random()
        if word:
            return SuggestWordResponse(
                suggestion=word,
                from_word=from_word_clean
            )

    # Hardcoded fallback with more evocative words
    from app.services.cache.vocabulary_pool import FALLBACK_WORDS
    return SuggestWordResponse(
        suggestion=random.choice(FALLBACK_WORDS),
        from_word=from_word_clean
    )


@router.get("/distance")
async def get_semantic_distance(
    anchor: str = Query(min_length=1, max_length=50),
    target: str = Query(min_length=1, max_length=50),
    auth = Depends(get_participant)
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
# ============================================
# FORWARDED ROUTES (to unified games router)
# These MUST come AFTER static routes like /suggest and /distance
# ============================================

@router.post("/", response_model=CreateBridgingGameResponse)
async def create_bridging_game(
    request: CreateBridgingGameRequest,
    auth = Depends(get_participant)
):
    """Create a new bridging game."""
    return await games_create_bridging(request, auth)


@router.get("/{game_id}", response_model=BridgingGameResponse)
async def get_bridging_game(
    game_id: str,
    auth = Depends(get_participant)
):
    """Get bridging game details."""
    return await games_get_bridging(game_id, auth)


@router.post("/{game_id}/clues", response_model=SubmitBridgingCluesResponse)
async def submit_bridging_clues(
    game_id: str,
    request: SubmitBridgingCluesRequest,
    auth = Depends(get_participant)
):
    """Submit clues for a bridging game."""
    return await games_submit_clues(game_id, request, auth)
