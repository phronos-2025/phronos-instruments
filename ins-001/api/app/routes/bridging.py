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
# UTILITY ROUTES (must be defined BEFORE parameterized routes)
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


@router.post("/join-v2/{share_code}", response_model=JoinBridgingGameResponseV2)
async def join_bridging_game_v2(
    share_code: str,
    auth = Depends(get_authenticated_client)
):
    """
    Join a bridging game via share code (V2: bridge-vs-bridge).

    Looks up game by share_code, assigns recipient, and returns game info
    for the recipient to create their own bridge.
    """
    from postgrest.exceptions import APIError

    supabase, user = auth

    # Find game by share_code in setup JSONB
    print(f"join_bridging_game_v2: Looking for share_code={share_code}")
    try:
        # Query all bridging games and filter by share_code
        all_games = supabase.table("games") \
            .select("*") \
            .eq("game_type", "bridging") \
            .execute()

        print(f"join_bridging_game_v2: Found {len(all_games.data or [])} bridging games")

        game = None
        for g in all_games.data or []:
            setup = g.get("setup", {})
            g_share_code = setup.get("share_code")
            if g_share_code:
                print(f"join_bridging_game_v2: Game {g['id'][:8]} has share_code={g_share_code}")
            if g_share_code == share_code:
                game = g
                break

        if not game:
            raise HTTPException(
                status_code=404,
                detail={"error": "Game not found", "detail": "Invalid or expired share code"}
            )

        print(f"join_bridging_game_v2: Found game {game['id']}")

    except HTTPException:
        raise
    except Exception as e:
        print(f"join_bridging_game_v2 error: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to join game", "detail": str(e)}
        )

    # Check if game already has a recipient (and it's not this user)
    if game.get("recipient_id") and game["recipient_id"] != user["id"]:
        raise HTTPException(
            status_code=400,
            detail={"error": "Game already has a recipient"}
        )

    # Prevent sender from joining their own game
    if game["sender_id"] == user["id"]:
        raise HTTPException(
            status_code=400,
            detail={"error": "Cannot join your own game"}
        )

    # Assign recipient if not already set
    if not game.get("recipient_id"):
        supabase.table("games").update({
            "recipient_id": user["id"],
            "recipient_type": "human"
        }).eq("id", game["id"]).execute()

    # Get setup data
    setup = game.get("setup", {})
    sender_input = game.get("sender_input", {})
    clues = sender_input.get("clues", [])

    return JoinBridgingGameResponseV2(
        game_id=game["id"],
        anchor_word=setup.get("anchor_word", ""),
        target_word=setup.get("target_word", ""),
        sender_clue_count=len(clues)
    )


# ============================================
# FORWARDED ROUTES (to unified games router)
# These MUST come AFTER static routes like /suggest and /distance
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


@router.post("/{game_id}/share", response_model=CreateBridgingShareResponse)
async def create_bridging_share(
    game_id: str,
    auth = Depends(get_authenticated_client)
):
    """
    Get or create a share link for a bridging game.

    Returns the share URL for inviting a human to compare their bridge.
    """
    from app.config import FRONTEND_URL
    from postgrest.exceptions import APIError
    import secrets

    supabase, user = auth

    # Get the game
    try:
        result = supabase.table("games") \
            .select("*") \
            .eq("id", game_id) \
            .eq("sender_id", user["id"]) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(
            status_code=404,
            detail={"error": "Game not found or not owned by you"}
        )

    if not result.data:
        raise HTTPException(
            status_code=404,
            detail={"error": "Game not found or not owned by you"}
        )

    game = result.data
    setup = game.get("setup", {})
    share_code = setup.get("share_code")

    # If no share code exists, generate one
    if not share_code:
        share_code = secrets.token_hex(4)
        setup["share_code"] = share_code
        supabase.table("games").update({"setup": setup}).eq("id", game_id).execute()

    # Construct the share URL with correct path
    share_url = f"{FRONTEND_URL}/ins-001/ins-001-2/join/{share_code}"

    return CreateBridgingShareResponse(
        share_code=share_code,
        share_url=share_url
    )
