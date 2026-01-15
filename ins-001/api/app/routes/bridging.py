"""
Bridging Routes - INS-001.2 Semantic Bridging

Handles bridging game operations where users create conceptual bridges
between two words (anchor and target).
"""

import asyncio
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
# Performance optimization: Use cached embeddings and precomputation
from app.services.cache import EmbeddingCache, VocabularyPool
from app.services.async_services import EagerPrecompute
from app.services.scoring import (
    score_union,
    compare_submissions,
    get_relevance_interpretation,
    get_divergence_interpretation,
    cosine_similarity,
)
import numpy as np
from app.services.scoring_bridging import (
    # Legacy functions for backwards compatibility
    calculate_reconstruction,
    calculate_bridge_similarity,
    get_reconstruction_interpretation,
    find_lexical_bridge,
    find_lexical_union,
    _is_morphological_variant
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


async def _calculate_relevance_percentile(
    participant_relevance: float,
    anchor_emb: list[float],
    target_emb: list[float],
    n_clues: int,
    supabase,
    n_samples: int = 200
) -> float:
    """
    Calculate percentile of participant's relevance score vs random word samples.

    Fetches random word embeddings from vocabulary using multiple random offsets
    to ensure true randomness, then samples from them to generate null distribution.

    Args:
        participant_relevance: Participant's relevance score (0-1)
        anchor_emb: Anchor word embedding
        target_emb: Target word embedding
        n_clues: Number of clues (to match sample size)
        supabase: Supabase client
        n_samples: Number of bootstrap samples (default 200 for speed)

    Returns:
        Percentile (0-100) indicating how participant compares to random samples
    """
    try:
        # Fetch random embeddings from multiple locations in the table
        # OPTIMIZATION: Fetch all in parallel instead of sequentially
        num_fetches = 5  # Reduced from 10 since we're fetching more per batch
        rows_per_fetch = 100

        async def fetch_batch(offset: int):
            """Fetch a batch of embeddings from a random offset."""
            result = supabase.table("vocabulary_embeddings") \
                .select("word, embedding") \
                .range(offset, offset + rows_per_fetch - 1) \
                .execute()
            embeddings = []
            if result.data:
                for row in result.data:
                    if row.get("embedding"):
                        emb = _parse_embedding(row["embedding"], row["word"])
                        if emb:
                            embeddings.append(emb)
            return embeddings

        # Generate random offsets and fetch all in parallel
        offsets = [random.randint(0, max(0, 50000 - rows_per_fetch)) for _ in range(num_fetches)]
        batch_results = await asyncio.gather(*[fetch_batch(offset) for offset in offsets])

        vocab_pool = []
        for batch in batch_results:
            vocab_pool.extend(batch)

        if len(vocab_pool) < n_clues:
            return 50.0  # Not enough vocabulary

        # Generate null distribution by sampling from pool
        random_relevances = []
        rng = np.random.default_rng()

        for _ in range(n_samples):
            # Sample n_clues embeddings without replacement
            indices = rng.choice(len(vocab_pool), size=n_clues, replace=False)
            sample_embs = [vocab_pool[i] for i in indices]

            # Calculate relevance for this random sample (same as score_union)
            # Using min() to match participant scoring - clue must connect to BOTH
            relevance_scores = []
            for clue_emb in sample_embs:
                sim_a = cosine_similarity(clue_emb, anchor_emb)
                sim_t = cosine_similarity(clue_emb, target_emb)
                relevance_scores.append(min(sim_a, sim_t))

            random_relevances.append(float(np.mean(relevance_scores)))

        if not random_relevances:
            return 50.0

        # Debug: log the distribution stats
        null_mean = float(np.mean(random_relevances))
        null_std = float(np.std(random_relevances))
        print(f"Bootstrap null distribution: mean={null_mean:.4f}, std={null_std:.4f}, participant={participant_relevance:.4f}")

        # Calculate percentile: what fraction of random samples is participant better than?
        percentile = float(np.mean([participant_relevance > r for r in random_relevances]) * 100)
        return percentile

    except Exception as e:
        print(f"Bootstrap percentile calculation failed: {e}")
        return 50.0  # Default to median on error


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

    # Start eager precomputation in background (while user types clues)
    # This eliminates the 20+ second wait on clue submission
    try:
        precompute = EagerPrecompute.get_instance()
        await precompute.start_bridging_precompute(
            game_id=game["id"],
            anchor=anchor,
            target=target,
            recipient_type=request.recipient_type.value,
            supabase=supabase
        )
    except Exception as e:
        # Non-fatal: precomputation failure just means slower clue submission
        print(f"Eager precompute failed to start: {e}")

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

    # Validate clues don't include anchor, target, or morphological variants
    for clue in clues_clean:
        if clue == anchor or clue == target:
            raise HTTPException(
                status_code=400,
                detail={"error": f"Clue '{clue}' cannot be the anchor or target word"}
            )
        if _is_morphological_variant(clue, anchor):
            raise HTTPException(
                status_code=400,
                detail={"error": f"Clue '{clue}' is too similar to the anchor word '{anchor}'"}
            )
        if _is_morphological_variant(clue, target):
            raise HTTPException(
                status_code=400,
                detail={"error": f"Clue '{clue}' is too similar to the target word '{target}'"}
            )

    # Check for duplicate clues and morphological variants between clues
    if len(clues_clean) != len(set(clues_clean)):
        raise HTTPException(
            status_code=400,
            detail={"error": "Clues must be unique"}
        )
    for i, clue1 in enumerate(clues_clean):
        for clue2 in clues_clean[i + 1:]:
            if _is_morphological_variant(clue1, clue2):
                raise HTTPException(
                    status_code=400,
                    detail={"error": f"Clues '{clue1}' and '{clue2}' are too similar to each other"}
                )

    # Try to use precomputed embeddings (from when game was created)
    precompute = EagerPrecompute.get_instance()
    precomputed = await precompute.get_precomputed_results(game_id, timeout_seconds=2.0)

    # Use cached embedding service for efficiency
    cache = EmbeddingCache.get_instance()
    is_haiku_game = game["recipient_type"] == "haiku"

    # OPTIMIZATION: Parallelize all expensive operations when precompute unavailable
    if precomputed and precomputed.anchor_embedding and precomputed.target_embedding:
        # Use precomputed anchor/target embeddings
        anchor_emb = precomputed.anchor_embedding
        target_emb = precomputed.target_embedding
        # Only embed the clues (much faster)
        clue_embs = await cache.get_embeddings_batch(clues_clean)
    else:
        # Fallback: embed everything (slower, but works if precompute failed)
        all_texts = [anchor, target] + clues_clean
        all_embeddings = await cache.get_embeddings_batch(all_texts)
        anchor_emb = all_embeddings[0]
        target_emb = all_embeddings[1]
        clue_embs = all_embeddings[2:]

    # Calculate unified scores using new scoring system (relevance + spread)
    participant_scores = score_union(clue_embs, anchor_emb, target_emb)
    relevance = participant_scores["relevance"]
    divergence = participant_scores["divergence"]  # DAT-style spread (0-100)

    # OPTIMIZATION: Run percentile calculation, lexical union, and haiku bridge in parallel
    # when precomputed values aren't available

    async def get_relevance_percentile():
        if precomputed and precomputed.null_samples and len(precomputed.null_samples) > 0:
            null_samples = precomputed.null_samples
            percentile = float(np.mean([relevance > r for r in null_samples]) * 100)
            return min(99.9, max(0.1, percentile))
        else:
            return await _calculate_relevance_percentile(
                participant_relevance=relevance,
                anchor_emb=anchor_emb,
                target_emb=target_emb,
                n_clues=len(clues_clean),
                supabase=supabase
            )

    async def get_lexical_union():
        try:
            n_clues = len(clues_clean)
            if precomputed and precomputed.lexical_bridge and len(precomputed.lexical_bridge) > 0:
                # Slice to match participant's concept count
                bridge = precomputed.lexical_bridge[:n_clues]
                embs = precomputed.lexical_embeddings[:n_clues] if precomputed.lexical_embeddings else await cache.get_embeddings_batch(bridge)
                return bridge, embs
            else:
                bridge = await find_lexical_union(anchor, target, n_clues, supabase)
                if bridge and len(bridge) > 0:
                    embs = await cache.get_embeddings_batch(bridge)
                    return bridge, embs
                return None, None
        except Exception as e:
            print(f"Lexical union calculation failed: {e}")
            return None, None

    async def get_haiku_bridge():
        if not is_haiku_game:
            return None, None
        try:
            n_clues = len(clues_clean)
            if precomputed and precomputed.haiku_clues and len(precomputed.haiku_clues) > 0:
                # Slice to match participant's concept count
                clues = precomputed.haiku_clues[:n_clues]
                embs = precomputed.haiku_embeddings[:n_clues] if precomputed.haiku_embeddings else await cache.get_embeddings_batch(clues)
                return clues, embs
            else:
                haiku_result = await haiku_build_bridge(anchor, target, num_clues=n_clues)
                if haiku_result.get("clues") and len(haiku_result["clues"]) > 0:
                    clues = haiku_result["clues"][:n_clues]
                    embs = await cache.get_embeddings_batch(clues)
                    return clues, embs
                return None, None
        except Exception as e:
            print(f"Haiku bridge generation failed: {e}")
            return None, None

    # Run all three in parallel
    relevance_percentile, (lexical_bridge, lexical_embs), (haiku_clues_result, haiku_clue_embs_result) = await asyncio.gather(
        get_relevance_percentile(),
        get_lexical_union(),
        get_haiku_bridge()
    )

    # Legacy field names for backwards compatibility
    divergence_score = divergence
    binding_score = relevance * 100  # Convert 0-1 to 0-100 for legacy display

    # Calculate lexical union scores
    lexical_similarity = None
    lexical_relevance = None
    lexical_divergence = None
    if lexical_bridge and lexical_embs:
        lexical_scores = score_union(lexical_embs, anchor_emb, target_emb)
        lexical_relevance = lexical_scores["relevance"]
        lexical_divergence = lexical_scores["divergence"]

        # Legacy: Calculate similarity between user's clues and lexical union
        lexical_sim_result = calculate_bridge_similarity(
            sender_clue_embeddings=clue_embs,
            recipient_clue_embeddings=lexical_embs,
            anchor_embedding=anchor_emb,
            target_embedding=target_emb
        )
        lexical_similarity = lexical_sim_result["overall"]

    # Generate share code
    share_code = None
    if game["recipient_type"] == "human":
        # Use database function to generate unique share code
        code_result = supabase.rpc("generate_bridging_share_code").execute()
        share_code = code_result.data

    update_data = {
        "clues": clues_clean,
        # New unified scoring fields
        "relevance": relevance,
        "relevance_percentile": relevance_percentile,
        "divergence": divergence,
        # Legacy fields for backwards compatibility
        "divergence_score": divergence_score,
        "binding_score": binding_score,
        # Lexical union
        "lexical_bridge": lexical_bridge,
        "lexical_relevance": lexical_relevance,
        "lexical_divergence": lexical_divergence,
        "lexical_similarity": lexical_similarity,  # Legacy
        "share_code": share_code,
        "status": "pending_guess" if game["recipient_type"] == "human" else "pending_clues"
    }

    # Use Haiku results from parallel computation (already fetched above)
    haiku_clues = haiku_clues_result
    haiku_clue_embs = haiku_clue_embs_result
    haiku_relevance = None
    haiku_divergence = None
    haiku_binding = None
    haiku_bridge_similarity = None
    # Legacy fields for backwards compat
    haiku_guessed_anchor = None
    haiku_guessed_target = None
    haiku_reconstruction_score = None

    if is_haiku_game and haiku_clues and haiku_clue_embs:
        # Calculate Haiku's scores using new unified scoring
        haiku_scores = score_union(haiku_clue_embs, anchor_emb, target_emb)
        haiku_relevance = haiku_scores["relevance"]
        haiku_divergence = haiku_scores["divergence"]  # DAT-style spread
        haiku_binding = haiku_relevance * 100  # Legacy: convert to 0-100

        # Calculate union similarity between sender and Haiku (legacy)
        similarity_result = calculate_bridge_similarity(
            sender_clue_embeddings=clue_embs,
            recipient_clue_embeddings=haiku_clue_embs,
            anchor_embedding=anchor_emb,
            target_embedding=target_emb
        )
        haiku_bridge_similarity = similarity_result["overall"]

        update_data["haiku_clues"] = haiku_clues
        update_data["haiku_relevance"] = haiku_relevance
        update_data["haiku_divergence"] = haiku_divergence
        update_data["haiku_binding"] = haiku_binding  # Legacy
        update_data["haiku_bridge_similarity"] = haiku_bridge_similarity
        update_data["status"] = "completed"

    # Try to update with all fields; if relevance_percentile column doesn't exist yet, retry without it
    try:
        supabase.table("games_bridging").update(update_data).eq("id", game_id).execute()
    except Exception as e:
        if "relevance_percentile" in str(e):
            # Column doesn't exist yet - remove and retry
            update_data.pop("relevance_percentile", None)
            supabase.table("games_bridging").update(update_data).eq("id", game_id).execute()
        else:
            raise

    return SubmitBridgingCluesResponse(
        game_id=game_id,
        clues=clues_clean,
        # New unified scoring fields
        relevance=relevance,
        relevance_percentile=relevance_percentile,
        divergence=divergence,
        # Legacy scoring fields
        divergence_score=divergence_score,
        binding_score=binding_score,
        # Lexical union
        lexical_bridge=lexical_bridge,
        lexical_relevance=lexical_relevance,
        lexical_divergence=lexical_divergence,
        lexical_similarity=lexical_similarity,
        status=BridgingGameStatus(update_data["status"]),
        share_code=share_code,
        # V2/V3 fields
        haiku_clues=haiku_clues,
        haiku_relevance=haiku_relevance,
        haiku_divergence=haiku_divergence,
        haiku_binding=haiku_binding,
        haiku_bridge_similarity=haiku_bridge_similarity,
        # Legacy fields (return None for V2/V3 games)
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

    Uses in-memory vocabulary pool for instant response (<50ms).
    Random words are usually distant enough for good gameplay.

    Args:
        from_word: Word to find suggestions from (currently unused for performance)
        attempt: Which attempt this is (1-indexed, currently unused)
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

    # Hardcoded fallback if both pool and database are unavailable
    from app.services.cache.vocabulary_pool import get_fallback_word
    return SuggestWordResponse(
        suggestion=get_fallback_word(),
        from_word=from_word.lower().strip() if from_word else None
    )


# ============================================
# SEMANTIC DISTANCE (V3 - DAT-style)
# ============================================

@router.get("/distance", response_model=SemanticDistanceResponse)
async def get_semantic_distance(
    anchor: str = Query(min_length=1, max_length=50),
    target: str = Query(min_length=1, max_length=50),
    auth = Depends(get_authenticated_client)
):
    """
    Get semantic distance (spread) between two words using DAT-style scoring.

    Uses cached embeddings for instant response (<200ms with cache hit).
    Distance is 0-100 scale (DAT convention): cosine distance × 100.

    DAT norms (Olson et al., 2021, PNAS):
    - < 50: Poor (often misunderstanding instructions)
    - 65-90: Common range
    - 75-80: Average
    - 95+: Very high
    - 100+: Almost never exceeded
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
        # Use cached embeddings for fast response
        cache = EmbeddingCache.get_instance()
        embeddings = await cache.get_embeddings_batch([anchor_clean, target_clean])
        anchor_emb = embeddings[0]
        target_emb = embeddings[1]

        # Calculate DAT-style distance: cosine distance × 100
        from app.services.scoring import cosine_similarity
        sim = cosine_similarity(anchor_emb, target_emb)
        distance = (1 - sim) * 100  # 0-100 scale

        # Interpretation using DAT norms (Olson et al., 2021)
        # < 50: poor, 65-90: common, 75-80: average, 95+: very high
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

        return SemanticDistanceResponse(
            anchor=anchor_clean,
            target=target_clean,
            distance=distance,
            interpretation=interpretation
        )

    except Exception as e:
        print(f"get_semantic_distance error: {e}")
        # Return a default average distance on error
        return SemanticDistanceResponse(
            anchor=anchor_clean,
            target=target_clean,
            distance=78.0,
            interpretation="average"
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

    share_url = f"{FRONTEND_URL}/ins-001/ins-001-2/join/{share_code}"

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

    # Validate clues don't include anchor, target, or morphological variants
    for clue in clues_clean:
        if clue == anchor or clue == target:
            raise HTTPException(
                status_code=400,
                detail={"error": f"Clue '{clue}' cannot be the anchor or target word"}
            )
        if _is_morphological_variant(clue, anchor):
            raise HTTPException(
                status_code=400,
                detail={"error": f"Clue '{clue}' is too similar to the anchor word '{anchor}'"}
            )
        if _is_morphological_variant(clue, target):
            raise HTTPException(
                status_code=400,
                detail={"error": f"Clue '{clue}' is too similar to the target word '{target}'"}
            )

    # Check for duplicate clues and morphological variants between clues
    if len(clues_clean) != len(set(clues_clean)):
        raise HTTPException(
            status_code=400,
            detail={"error": "Clues must be unique"}
        )
    for i, clue1 in enumerate(clues_clean):
        for clue2 in clues_clean[i + 1:]:
            if _is_morphological_variant(clue1, clue2):
                raise HTTPException(
                    status_code=400,
                    detail={"error": f"Clues '{clue1}' and '{clue2}' are too similar to each other"}
                )

    # Batch embed everything: anchor, target, sender clues, recipient clues
    all_texts = [anchor, target] + sender_clues + clues_clean
    all_embeddings = await get_embeddings_batch(all_texts)

    anchor_emb = all_embeddings[0]
    target_emb = all_embeddings[1]
    sender_clue_embs = all_embeddings[2:2 + len(sender_clues)]
    recipient_clue_embs = all_embeddings[2 + len(sender_clues):]

    # Calculate recipient's scores using new unified scoring
    recipient_scores = score_union(recipient_clue_embs, anchor_emb, target_emb)
    recipient_relevance = recipient_scores["relevance"]
    recipient_divergence = recipient_scores["divergence"]  # DAT-style spread

    # Calculate bridge similarity (legacy)
    similarity_result = calculate_bridge_similarity(
        sender_clue_embeddings=sender_clue_embs,
        recipient_clue_embeddings=recipient_clue_embs,
        anchor_embedding=anchor_emb,
        target_embedding=target_emb
    )

    # Update game
    update_data = {
        "recipient_clues": clues_clean,
        "recipient_relevance": recipient_relevance,
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
        # V3: Unified scoring
        relevance=game.get("relevance"),
        relevance_percentile=game.get("relevance_percentile"),
        divergence=game.get("divergence"),
        # Legacy scoring
        divergence_score=game.get("divergence_score"),
        binding_score=game.get("binding_score"),
        # Lexical union
        lexical_bridge=game.get("lexical_bridge"),
        lexical_relevance=game.get("lexical_relevance"),
        lexical_divergence=game.get("lexical_divergence"),
        lexical_similarity=game.get("lexical_similarity"),
        # Legacy V1: Human recipient guesses
        guessed_anchor=game.get("guessed_anchor"),
        guessed_target=game.get("guessed_target"),
        reconstruction_score=game.get("reconstruction_score"),
        anchor_similarity=game.get("anchor_similarity"),
        target_similarity=game.get("target_similarity"),
        order_swapped=game.get("order_swapped"),
        exact_anchor_match=game.get("exact_anchor_match"),
        exact_target_match=game.get("exact_target_match"),
        # V2/V3: Human recipient union
        recipient_clues=game.get("recipient_clues"),
        recipient_relevance=game.get("recipient_relevance"),
        recipient_divergence=game.get("recipient_divergence"),
        recipient_binding=game.get("recipient_binding"),
        bridge_similarity=game.get("bridge_similarity"),
        # Legacy V1: Haiku guesses
        haiku_guessed_anchor=game.get("haiku_guessed_anchor"),
        haiku_guessed_target=game.get("haiku_guessed_target"),
        haiku_reconstruction_score=game.get("haiku_reconstruction_score"),
        # V2/V3: Haiku union
        haiku_clues=game.get("haiku_clues"),
        haiku_relevance=game.get("haiku_relevance"),
        haiku_divergence=game.get("haiku_divergence"),
        haiku_binding=game.get("haiku_binding"),
        haiku_bridge_similarity=game.get("haiku_bridge_similarity"),
        # Statistical baseline
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

    # Calculate Haiku's scores using new unified scoring
    haiku_scores = score_union(haiku_clue_embs, anchor_emb, target_emb)
    haiku_relevance = haiku_scores["relevance"]
    haiku_divergence = haiku_scores["divergence"]  # DAT-style spread

    # Calculate bridge similarity (how similar Haiku's path is to sender's) - legacy
    similarity_result = calculate_bridge_similarity(
        sender_clue_embeddings=sender_clue_embs,
        recipient_clue_embeddings=haiku_clue_embs
    )
    haiku_bridge_similarity = similarity_result["overall"]

    # Update game with Haiku's bridge
    supabase.table("games_bridging").update({
        "haiku_clues": haiku_clues,
        "haiku_relevance": haiku_relevance,
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
