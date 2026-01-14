"""
Bridging Routes - INS-001.2 Semantic Bridging

Handles bridging game operations where users create conceptual bridges
between two words (anchor and target).
"""

import json
import random
from fastapi import APIRouter, HTTPException, Depends, Query
from postgrest.exceptions import APIError
from app.models import (
    CreateBridgingGameRequest, CreateBridgingGameResponse,
    SubmitBridgingCluesRequest, SubmitBridgingCluesResponse,
    SubmitBridgingGuessRequest, SubmitBridgingGuessResponse,
    BridgingGameResponse, BridgingGameStatus, BridgingRecipientType,
    SuggestWordResponse,
    CreateBridgingShareResponse, JoinBridgingGameResponse,
    TriggerHaikuGuessResponse,
    ErrorResponse,
    # V2 models for bridge-vs-bridge
    SemanticDistanceResponse,
    JoinBridgingGameResponseV2,
    SubmitBridgingBridgeRequest, SubmitBridgingBridgeResponse,
    TriggerHaikuBridgeResponse,
    BridgingGameResponseV2
)
from app.middleware.auth import get_authenticated_client
from app.services.embeddings import get_embedding, get_embeddings_batch
from app.services.scoring_bridging import (
    calculate_divergence,
    calculate_reconstruction,
    calculate_bridge_similarity,
    calculate_semantic_distance,
    calculate_statistical_baseline,
    get_divergence_interpretation,
    get_reconstruction_interpretation,
    find_lexical_bridge
)
from app.services.llm import haiku_reconstruct_bridge, haiku_build_bridge
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY, FRONTEND_URL
from supabase import create_client

router = APIRouter()


def _parse_embedding(embedding, word: str) -> list[float] | None:
    """Parse embedding from various formats returned by Supabase."""
    if isinstance(embedding, str):
        try:
            embedding = json.loads(embedding)
        except (json.JSONDecodeError, ValueError):
            try:
                cleaned = embedding.strip('[]{}')
                embedding = [float(x.strip()) for x in cleaned.replace(',', ' ').split() if x.strip()]
            except (ValueError, AttributeError):
                return None
    elif not isinstance(embedding, list):
        try:
            embedding = list(embedding)
        except (TypeError, ValueError):
            return None

    if not isinstance(embedding, list) or not all(isinstance(x, (int, float)) for x in embedding):
        return None

    return embedding


# ============================================
# CREATE GAME
# ============================================

@router.post("/", response_model=CreateBridgingGameResponse)
async def create_bridging_game(
    request: CreateBridgingGameRequest,
    auth = Depends(get_authenticated_client)
):
    """
    Create a new bridging game.

    Anchor and target can be any words (not restricted to vocabulary).
    """
    supabase, user = auth
    anchor = request.anchor_word.lower().strip()
    target = request.target_word.lower().strip()

    # Validate anchor != target
    if anchor == target:
        raise HTTPException(
            status_code=400,
            detail={"error": "Anchor and target must be different words"}
        )

    # Create game record (clues not yet provided)
    result = supabase.table("games_bridging").insert({
        "sender_id": user["id"],
        "anchor_word": anchor,
        "target_word": target,
        "clues": [],  # Will be updated when clues are submitted
        "recipient_type": request.recipient_type.value,
        "status": "pending_clues"
    }).execute()

    game = result.data[0]

    return CreateBridgingGameResponse(
        game_id=game["id"],
        anchor_word=game["anchor_word"],
        target_word=game["target_word"],
        status=BridgingGameStatus.PENDING_CLUES
    )


# ============================================
# SUBMIT CLUES
# ============================================

@router.post("/{game_id}/clues", response_model=SubmitBridgingCluesResponse)
async def submit_bridging_clues(
    game_id: str,
    request: SubmitBridgingCluesRequest,
    auth = Depends(get_authenticated_client)
):
    """
    Submit clues for a bridging game.

    Clues should connect the anchor and target words.
    """
    supabase, user = auth

    # Clean clues
    clues_clean = [c.lower().strip() for c in request.clues if c.strip()]

    # Validate clue count
    if len(clues_clean) < 1 or len(clues_clean) > 5:
        raise HTTPException(
            status_code=400,
            detail={"error": "Must provide 1-5 clues"}
        )

    # Get game
    try:
        result = supabase.table("games_bridging") \
            .select("*") \
            .eq("id", game_id) \
            .eq("sender_id", user["id"]) \
            .eq("status", "pending_clues") \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})

    game = result.data
    anchor = game["anchor_word"]
    target = game["target_word"]

    # Validate clues don't include anchor or target
    for clue in clues_clean:
        if clue == anchor or clue == target:
            raise HTTPException(
                status_code=400,
                detail={"error": f"Clue '{clue}' cannot be the anchor or target word"}
            )

    # Check for duplicate clues
    if len(clues_clean) != len(set(clues_clean)):
        raise HTTPException(
            status_code=400,
            detail={"error": "Clues must be unique"}
        )

    # Batch embed anchor, target, and all clues
    all_texts = [anchor, target] + clues_clean
    all_embeddings = await get_embeddings_batch(all_texts)

    anchor_emb = all_embeddings[0]
    target_emb = all_embeddings[1]
    clue_embs = all_embeddings[2:]

    # Calculate divergence (perpendicular distance from anchor-target line)
    divergence_score = calculate_divergence(anchor_emb, target_emb, clue_embs)

    # Calculate lexical bridge (optimal embedding-based path with same step count)
    lexical_bridge = None
    try:
        lexical_bridge = await find_lexical_bridge(anchor, target, len(clues_clean), supabase)
    except Exception as e:
        print(f"Lexical bridge calculation failed: {e}")
        # Non-fatal - continue without lexical bridge

    # Generate share code
    share_code = None
    if game["recipient_type"] == "human":
        # Use database function to generate unique share code
        code_result = supabase.rpc("generate_bridging_share_code").execute()
        share_code = code_result.data

    update_data = {
        "clues": clues_clean,
        "divergence_score": divergence_score,
        "lexical_bridge": lexical_bridge,
        "share_code": share_code,
        "status": "pending_guess" if game["recipient_type"] == "human" else "pending_clues"
    }

    # If Haiku recipient, have Haiku build its own bridge (V2 approach)
    haiku_clues = None
    haiku_divergence = None
    haiku_bridge_similarity = None
    # Legacy fields for backwards compat
    haiku_guessed_anchor = None
    haiku_guessed_target = None
    haiku_reconstruction_score = None

    if game["recipient_type"] == "haiku":
        # V2: Haiku builds its own bridge
        haiku_result = await haiku_build_bridge(anchor, target, num_clues=3)

        if haiku_result.get("clues") and len(haiku_result["clues"]) > 0:
            haiku_clues = haiku_result["clues"]

            # Embed Haiku's clues
            haiku_clue_embs = await get_embeddings_batch(haiku_clues)

            # Calculate Haiku's divergence
            haiku_divergence = calculate_divergence(anchor_emb, target_emb, haiku_clue_embs)

            # Calculate bridge similarity between sender and Haiku
            similarity_result = calculate_bridge_similarity(
                sender_clue_embeddings=clue_embs,
                recipient_clue_embeddings=haiku_clue_embs,
                anchor_embedding=anchor_emb,
                target_embedding=target_emb
            )
            haiku_bridge_similarity = similarity_result["overall"]

            update_data["haiku_clues"] = haiku_clues
            update_data["haiku_divergence"] = haiku_divergence
            update_data["haiku_bridge_similarity"] = haiku_bridge_similarity
            update_data["status"] = "completed"

    supabase.table("games_bridging").update(update_data).eq("id", game_id).execute()

    return SubmitBridgingCluesResponse(
        game_id=game_id,
        clues=clues_clean,
        divergence_score=divergence_score,
        lexical_bridge=lexical_bridge,
        status=BridgingGameStatus(update_data["status"]),
        share_code=share_code,
        # V2 fields
        haiku_clues=haiku_clues,
        haiku_divergence=haiku_divergence,
        haiku_bridge_similarity=haiku_bridge_similarity,
        # Legacy fields (return None for V2 games)
        haiku_guessed_anchor=haiku_guessed_anchor,
        haiku_guessed_target=haiku_guessed_target,
        haiku_reconstruction_score=haiku_reconstruction_score
    )


# ============================================
# SUGGEST WORD
# ============================================

@router.get("/suggest", response_model=SuggestWordResponse)
async def suggest_distant_word(
    from_word: str = Query(default=None, max_length=50),
    attempt: int = Query(default=1, ge=1, le=100),
    auth = Depends(get_authenticated_client)
):
    """
    Suggest a random word from vocabulary.

    Uses fast random selection for instant response (<100ms).
    Random words are usually distant enough for good gameplay.

    Args:
        from_word: Word to find suggestions from (currently unused for performance)
        attempt: Which attempt this is (1-indexed, currently unused)
    """
    supabase, user = auth

    # Get a random word from vocabulary
    # Fast path: single row fetch at random offset
    try:
        random_offset = random.randint(0, 49999)
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

    # Hardcoded fallback if database is unavailable
    fallback_words = [
        "universe", "cosmos", "ocean", "mountain", "algorithm",
        "symphony", "crystal", "whisper", "thunder", "horizon",
        "paradox", "labyrinth", "enigma", "essence", "catalyst",
        "zenith", "nebula", "fortress", "cascade", "phantom"
    ]
    return SuggestWordResponse(
        suggestion=random.choice(fallback_words),
        from_word=from_word.lower().strip() if from_word else None
    )


# ============================================
# SEMANTIC DISTANCE (V2)
# ============================================

@router.get("/distance", response_model=SemanticDistanceResponse)
async def get_semantic_distance(
    anchor: str = Query(min_length=1, max_length=50),
    target: str = Query(min_length=1, max_length=50),
    auth = Depends(get_authenticated_client)
):
    """
    Get semantic distance between two words.

    Used to show how "far apart" anchor and target are on the word selection screen.
    Distance is 0-100 scale: 0 = identical, 100 = maximally distant.
    """
    anchor_clean = anchor.lower().strip()
    target_clean = target.lower().strip()

    if anchor_clean == target_clean:
        return SemanticDistanceResponse(
            anchor=anchor_clean,
            target=target_clean,
            distance=0.0,
            interpretation="identical"
        )

    try:
        # Batch embed both words
        embeddings = await get_embeddings_batch([anchor_clean, target_clean])
        anchor_emb = embeddings[0]
        target_emb = embeddings[1]

        # Calculate distance
        distance = calculate_semantic_distance(anchor_emb, target_emb)

        # Interpretation
        if distance < 15:
            interpretation = "close"
        elif distance < 30:
            interpretation = "moderate"
        elif distance < 45:
            interpretation = "distant"
        else:
            interpretation = "very distant"

        return SemanticDistanceResponse(
            anchor=anchor_clean,
            target=target_clean,
            distance=distance,
            interpretation=interpretation
        )

    except Exception as e:
        print(f"get_semantic_distance error: {e}")
        # Return a default moderate distance on error
        return SemanticDistanceResponse(
            anchor=anchor_clean,
            target=target_clean,
            distance=30.0,
            interpretation="moderate"
        )


# ============================================
# SHARE GAME
# ============================================

@router.post("/{game_id}/share", response_model=CreateBridgingShareResponse)
async def create_bridging_share(
    game_id: str,
    auth = Depends(get_authenticated_client)
):
    """
    Create or get share code for a bridging game.

    Only the sender can create a share link.
    """
    supabase, user = auth

    # Get game
    try:
        result = supabase.table("games_bridging") \
            .select("*") \
            .eq("id", game_id) \
            .eq("sender_id", user["id"]) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})

    game = result.data

    # Check game has clues
    if not game.get("clues") or len(game["clues"]) == 0:
        raise HTTPException(
            status_code=400,
            detail={"error": "Cannot share game without clues"}
        )

    # Get or create share code
    share_code = game.get("share_code")
    if not share_code:
        code_result = supabase.rpc("generate_bridging_share_code").execute()
        share_code = code_result.data

        supabase.table("games_bridging") \
            .update({"share_code": share_code, "status": "pending_guess"}) \
            .eq("id", game_id) \
            .execute()

    share_url = f"{FRONTEND_URL}/ins-001-2/join/{share_code}"

    return CreateBridgingShareResponse(
        share_code=share_code,
        share_url=share_url
    )


# ============================================
# JOIN GAME
# ============================================

@router.post("/join/{share_code}", response_model=JoinBridgingGameResponse)
async def join_bridging_game(
    share_code: str,
    auth = Depends(get_authenticated_client)
):
    """
    Join a bridging game via share code.

    Assigns the current user as recipient.
    """
    supabase, user = auth

    # Use database function for atomic join
    try:
        result = supabase.rpc(
            "join_bridging_game_via_code",
            {"p_share_code": share_code, "p_recipient_id": user["id"]}
        ).execute()

        game_id = result.data
    except Exception as e:
        error_msg = str(e)
        if "Invalid share code" in error_msg:
            raise HTTPException(status_code=404, detail={"error": "Invalid or expired share code"})
        elif "Cannot join your own game" in error_msg:
            raise HTTPException(status_code=400, detail={"error": "Cannot join your own game"})
        elif "already has a recipient" in error_msg:
            raise HTTPException(status_code=400, detail={"error": "Game already has a recipient"})
        elif "not accepting guesses" in error_msg:
            raise HTTPException(status_code=400, detail={"error": "Game is not accepting guesses"})
        else:
            raise HTTPException(status_code=400, detail={"error": str(e)})

    # Get game details (clues only, NOT anchor/target)
    game_result = supabase.table("games_bridging") \
        .select("id, clues") \
        .eq("id", game_id) \
        .single() \
        .execute()

    game = game_result.data

    return JoinBridgingGameResponse(
        game_id=game["id"],
        clues=game["clues"]
    )


# ============================================
# JOIN GAME V2 (Bridge-vs-Bridge)
# ============================================

@router.post("/join-v2/{share_code}", response_model=JoinBridgingGameResponseV2)
async def join_bridging_game_v2(
    share_code: str,
    auth = Depends(get_authenticated_client)
):
    """
    Join a bridging game via share code (V2: bridge-vs-bridge).

    In V2, recipient sees anchor + target and builds their own bridge,
    rather than guessing the words from clues.
    """
    supabase, user = auth

    # Use database function for atomic join
    try:
        result = supabase.rpc(
            "join_bridging_game_via_code",
            {"p_share_code": share_code, "p_recipient_id": user["id"]}
        ).execute()

        game_id = result.data
    except Exception as e:
        error_msg = str(e)
        if "Invalid share code" in error_msg:
            raise HTTPException(status_code=404, detail={"error": "Invalid or expired share code"})
        elif "Cannot join your own game" in error_msg:
            raise HTTPException(status_code=400, detail={"error": "Cannot join your own game"})
        elif "already has a recipient" in error_msg:
            raise HTTPException(status_code=400, detail={"error": "Game already has a recipient"})
        elif "not accepting guesses" in error_msg:
            raise HTTPException(status_code=400, detail={"error": "Game is not accepting guesses"})
        else:
            raise HTTPException(status_code=400, detail={"error": str(e)})

    # Get game details: anchor, target, and clue count (NOT the actual clues)
    game_result = supabase.table("games_bridging") \
        .select("id, anchor_word, target_word, clues") \
        .eq("id", game_id) \
        .single() \
        .execute()

    game = game_result.data

    return JoinBridgingGameResponseV2(
        game_id=game["id"],
        anchor_word=game["anchor_word"],
        target_word=game["target_word"],
        sender_clue_count=len(game["clues"]) if game["clues"] else 0
    )


# ============================================
# SUBMIT BRIDGE V2 (Recipient's Bridge)
# ============================================

@router.post("/{game_id}/bridge", response_model=SubmitBridgingBridgeResponse)
async def submit_bridging_bridge(
    game_id: str,
    request: SubmitBridgingBridgeRequest,
    auth = Depends(get_authenticated_client)
):
    """
    Submit recipient's bridge (their clues) for comparison.

    In V2, recipient builds their own bridge connecting anchor-target,
    and we compare the two bridges for similarity.
    """
    supabase, user = auth

    # Clean clues
    clues_clean = [c.lower().strip() for c in request.clues if c.strip()]

    if len(clues_clean) < 1 or len(clues_clean) > 5:
        raise HTTPException(
            status_code=400,
            detail={"error": "Must provide 1-5 clues"}
        )

    # Get game (user must be recipient)
    try:
        result = supabase.table("games_bridging") \
            .select("*") \
            .eq("id", game_id) \
            .eq("recipient_id", user["id"]) \
            .eq("status", "pending_guess") \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})

    game = result.data
    anchor = game["anchor_word"]
    target = game["target_word"]
    sender_clues = game["clues"]

    # Validate clues don't include anchor or target
    for clue in clues_clean:
        if clue == anchor or clue == target:
            raise HTTPException(
                status_code=400,
                detail={"error": f"Clue '{clue}' cannot be the anchor or target word"}
            )

    # Check for duplicate clues
    if len(clues_clean) != len(set(clues_clean)):
        raise HTTPException(
            status_code=400,
            detail={"error": "Clues must be unique"}
        )

    # Batch embed everything: anchor, target, sender clues, recipient clues
    all_texts = [anchor, target] + sender_clues + clues_clean
    all_embeddings = await get_embeddings_batch(all_texts)

    anchor_emb = all_embeddings[0]
    target_emb = all_embeddings[1]
    sender_clue_embs = all_embeddings[2:2 + len(sender_clues)]
    recipient_clue_embs = all_embeddings[2 + len(sender_clues):]

    # Calculate recipient's divergence
    recipient_divergence = calculate_divergence(anchor_emb, target_emb, recipient_clue_embs)

    # Calculate bridge similarity
    similarity_result = calculate_bridge_similarity(
        sender_clue_embeddings=sender_clue_embs,
        recipient_clue_embeddings=recipient_clue_embs,
        anchor_embedding=anchor_emb,
        target_embedding=target_emb
    )

    # Update game
    update_data = {
        "recipient_clues": clues_clean,
        "recipient_divergence": recipient_divergence,
        "bridge_similarity": similarity_result["overall"],
        "status": "completed",
        "completed_at": "now()"
    }

    supabase.table("games_bridging").update(update_data).eq("id", game_id).execute()

    return SubmitBridgingBridgeResponse(
        game_id=game_id,
        recipient_clues=clues_clean,
        recipient_divergence=recipient_divergence,
        sender_clues=sender_clues,
        sender_divergence=game["divergence_score"],
        bridge_similarity=similarity_result["overall"],
        path_alignment=similarity_result["path_alignment"],
        anchor_word=anchor,
        target_word=target,
        status=BridgingGameStatus.COMPLETED
    )


# ============================================
# SUBMIT GUESS (Legacy)
# ============================================

@router.post("/{game_id}/guess", response_model=SubmitBridgingGuessResponse)
async def submit_bridging_guess(
    game_id: str,
    request: SubmitBridgingGuessRequest,
    auth = Depends(get_authenticated_client)
):
    """
    Submit reconstruction guesses for a bridging game.

    Recipient guesses the anchor and target words from the clues.
    """
    supabase, user = auth

    guessed_anchor = request.guessed_anchor.lower().strip()
    guessed_target = request.guessed_target.lower().strip()

    # Validate different words
    if guessed_anchor == guessed_target:
        raise HTTPException(
            status_code=400,
            detail={"error": "Anchor and target guesses must be different"}
        )

    # Get game (user must be recipient)
    try:
        result = supabase.table("games_bridging") \
            .select("*") \
            .eq("id", game_id) \
            .eq("recipient_id", user["id"]) \
            .eq("status", "pending_guess") \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})

    game = result.data
    true_anchor = game["anchor_word"]
    true_target = game["target_word"]

    # Batch embed true words and guessed words
    all_texts = [true_anchor, true_target, guessed_anchor, guessed_target]
    all_embs = await get_embeddings_batch(all_texts)

    true_anchor_emb = all_embs[0]
    true_target_emb = all_embs[1]
    guessed_anchor_emb = all_embs[2]
    guessed_target_emb = all_embs[3]

    # Calculate reconstruction score
    recon = calculate_reconstruction(
        true_anchor_embedding=true_anchor_emb,
        true_target_embedding=true_target_emb,
        guessed_anchor_embedding=guessed_anchor_emb,
        guessed_target_embedding=guessed_target_emb,
        true_anchor=true_anchor,
        true_target=true_target,
        guessed_anchor=guessed_anchor,
        guessed_target=guessed_target
    )

    # Update game
    update_data = {
        "guessed_anchor": guessed_anchor,
        "guessed_target": guessed_target,
        "reconstruction_score": recon["overall"],
        "anchor_similarity": recon["anchor_similarity"],
        "target_similarity": recon["target_similarity"],
        "order_swapped": recon["order_swapped"],
        "exact_anchor_match": recon["exact_anchor_match"],
        "exact_target_match": recon["exact_target_match"],
        "status": "completed",
        "completed_at": "now()"
    }

    supabase.table("games_bridging").update(update_data).eq("id", game_id).execute()

    return SubmitBridgingGuessResponse(
        game_id=game_id,
        guessed_anchor=guessed_anchor,
        guessed_target=guessed_target,
        reconstruction_score=recon["overall"],
        anchor_similarity=recon["anchor_similarity"],
        target_similarity=recon["target_similarity"],
        order_swapped=recon["order_swapped"],
        exact_anchor_match=recon["exact_anchor_match"],
        exact_target_match=recon["exact_target_match"],
        true_anchor=true_anchor,
        true_target=true_target,
        status=BridgingGameStatus.COMPLETED
    )


# ============================================
# GET GAME
# ============================================

@router.get("/{game_id}", response_model=BridgingGameResponse)
async def get_bridging_game(
    game_id: str,
    auth = Depends(get_authenticated_client)
):
    """Get bridging game details. RLS ensures user can only see their own games."""
    supabase, user = auth

    try:
        result = supabase.table("games_bridging") \
            .select("*") \
            .eq("id", game_id) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})

    game = result.data

    return BridgingGameResponse(
        game_id=game["id"],
        sender_id=game["sender_id"],
        recipient_id=game.get("recipient_id"),
        recipient_type=BridgingRecipientType(game["recipient_type"]) if game.get("recipient_type") else BridgingRecipientType.HAIKU,
        anchor_word=game["anchor_word"],
        target_word=game["target_word"],
        clues=game.get("clues"),
        divergence_score=game.get("divergence_score"),
        lexical_bridge=game.get("lexical_bridge"),
        guessed_anchor=game.get("guessed_anchor"),
        guessed_target=game.get("guessed_target"),
        reconstruction_score=game.get("reconstruction_score"),
        anchor_similarity=game.get("anchor_similarity"),
        target_similarity=game.get("target_similarity"),
        order_swapped=game.get("order_swapped"),
        exact_anchor_match=game.get("exact_anchor_match"),
        exact_target_match=game.get("exact_target_match"),
        haiku_guessed_anchor=game.get("haiku_guessed_anchor"),
        haiku_guessed_target=game.get("haiku_guessed_target"),
        haiku_reconstruction_score=game.get("haiku_reconstruction_score"),
        statistical_guessed_anchor=game.get("statistical_guessed_anchor"),
        statistical_guessed_target=game.get("statistical_guessed_target"),
        statistical_baseline_score=game.get("statistical_baseline_score"),
        status=BridgingGameStatus(game["status"]),
        share_code=game.get("share_code"),
        created_at=game["created_at"],
        completed_at=game.get("completed_at")
    )


# ============================================
# TRIGGER HAIKU GUESS
# ============================================

@router.post("/{game_id}/haiku-guess", response_model=TriggerHaikuGuessResponse)
async def trigger_haiku_guess(
    game_id: str,
    auth = Depends(get_authenticated_client)
):
    """
    Trigger Haiku reconstruction for a game.

    Can be called after human recipient has guessed, or for games
    that didn't initially use Haiku as recipient.
    """
    supabase, user = auth

    # Get game (sender only)
    try:
        result = supabase.table("games_bridging") \
            .select("*") \
            .eq("id", game_id) \
            .eq("sender_id", user["id"]) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})

    game = result.data

    # Check game has clues
    if not game.get("clues") or len(game["clues"]) == 0:
        raise HTTPException(
            status_code=400,
            detail={"error": "Cannot get Haiku guess without clues"}
        )

    # Check if Haiku already guessed
    if game.get("haiku_guessed_anchor") and game.get("haiku_guessed_target"):
        return TriggerHaikuGuessResponse(
            game_id=game_id,
            haiku_guessed_anchor=game["haiku_guessed_anchor"],
            haiku_guessed_target=game["haiku_guessed_target"],
            haiku_reconstruction_score=game["haiku_reconstruction_score"]
        )

    # Get Haiku reconstruction
    haiku_result = await haiku_reconstruct_bridge(game["clues"])

    if not haiku_result.get("guessed_anchor") or not haiku_result.get("guessed_target"):
        raise HTTPException(
            status_code=500,
            detail={"error": "Haiku could not generate guesses"}
        )

    haiku_guessed_anchor = haiku_result["guessed_anchor"]
    haiku_guessed_target = haiku_result["guessed_target"]

    # Get embeddings for scoring
    all_texts = [
        game["anchor_word"],
        game["target_word"],
        haiku_guessed_anchor,
        haiku_guessed_target
    ]
    all_embs = await get_embeddings_batch(all_texts)

    recon = calculate_reconstruction(
        true_anchor_embedding=all_embs[0],
        true_target_embedding=all_embs[1],
        guessed_anchor_embedding=all_embs[2],
        guessed_target_embedding=all_embs[3],
        true_anchor=game["anchor_word"],
        true_target=game["target_word"],
        guessed_anchor=haiku_guessed_anchor,
        guessed_target=haiku_guessed_target
    )

    # Update game
    supabase.table("games_bridging").update({
        "haiku_guessed_anchor": haiku_guessed_anchor,
        "haiku_guessed_target": haiku_guessed_target,
        "haiku_reconstruction_score": recon["overall"]
    }).eq("id", game_id).execute()

    return TriggerHaikuGuessResponse(
        game_id=game_id,
        haiku_guessed_anchor=haiku_guessed_anchor,
        haiku_guessed_target=haiku_guessed_target,
        haiku_reconstruction_score=recon["overall"]
    )


# ============================================
# HAIKU BRIDGE (V2)
# ============================================

@router.post("/{game_id}/haiku-bridge", response_model=TriggerHaikuBridgeResponse)
async def trigger_haiku_bridge(
    game_id: str,
    auth = Depends(get_authenticated_client)
):
    """
    Trigger Haiku to build its own bridge between anchor and target.

    V2 approach: Instead of guessing the anchor/target from clues,
    Haiku generates its own clues (matching the sender's clue count)
    that connect anchor to target. This creates a comparable baseline.
    """
    supabase, user = auth

    # Get game (sender only)
    try:
        result = supabase.table("games_bridging") \
            .select("*") \
            .eq("id", game_id) \
            .eq("sender_id", user["id"]) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})

    game = result.data

    # Check game has clues (need to know how many steps the user took)
    if not game.get("clues") or len(game["clues"]) == 0:
        raise HTTPException(
            status_code=400,
            detail={"error": "Cannot get Haiku bridge without sender clues"}
        )

    # Check if Haiku already built a bridge
    if game.get("haiku_clues") and len(game["haiku_clues"]) > 0:
        return TriggerHaikuBridgeResponse(
            game_id=game_id,
            haiku_clues=game["haiku_clues"],
            haiku_divergence=game["haiku_divergence"] or 0,
            haiku_bridge_similarity=game["haiku_bridge_similarity"] or 0
        )

    anchor = game["anchor_word"]
    target = game["target_word"]
    num_clues = len(game["clues"])  # Match sender's step count

    # Have Haiku build its own bridge
    haiku_result = await haiku_build_bridge(anchor, target, num_clues=num_clues)

    if not haiku_result.get("clues") or len(haiku_result["clues"]) == 0:
        raise HTTPException(
            status_code=500,
            detail={"error": "Haiku could not generate bridge clues"}
        )

    haiku_clues = haiku_result["clues"]

    # Get embeddings for scoring
    anchor_emb = await get_embedding(anchor)
    target_emb = await get_embedding(target)
    sender_clue_embs = await get_embeddings_batch(game["clues"])
    haiku_clue_embs = await get_embeddings_batch(haiku_clues)

    # Calculate Haiku's divergence (how creative its path is)
    haiku_divergence = calculate_divergence(anchor_emb, target_emb, haiku_clue_embs)

    # Calculate bridge similarity (how similar Haiku's path is to sender's)
    similarity_result = calculate_bridge_similarity(
        sender_clue_embeddings=sender_clue_embs,
        recipient_clue_embeddings=haiku_clue_embs
    )
    haiku_bridge_similarity = similarity_result["overall"]

    # Update game with Haiku's bridge
    supabase.table("games_bridging").update({
        "haiku_clues": haiku_clues,
        "haiku_divergence": haiku_divergence,
        "haiku_bridge_similarity": haiku_bridge_similarity,
        "status": "completed"
    }).eq("id", game_id).execute()

    return TriggerHaikuBridgeResponse(
        game_id=game_id,
        haiku_clues=haiku_clues,
        haiku_divergence=haiku_divergence,
        haiku_bridge_similarity=haiku_bridge_similarity
    )
