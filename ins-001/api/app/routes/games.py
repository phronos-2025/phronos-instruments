"""
Games Routes - INS-001 Semantic Associations

Schema Version: 2.0 - Unified games table with JSONB payloads.

Handles both radiation and bridging game CRUD operations.
"""

import asyncio
import json
from fastapi import APIRouter, HTTPException, Depends
from postgrest.exceptions import APIError
from app.models import (
    # Radiation
    CreateRadiationGameRequest, CreateRadiationGameResponse,
    SubmitRadiationCluesRequest, SubmitRadiationCluesResponse,
    SubmitRadiationGuessesRequest, SubmitRadiationGuessesResponse,
    RadiationGameResponse,
    # Bridging
    CreateBridgingGameRequest, CreateBridgingGameResponse,
    SubmitBridgingCluesRequest, SubmitBridgingCluesResponse,
    SubmitBridgingBridgeRequest, SubmitBridgingBridgeResponse,
    BridgingGameResponse,
    # Shared
    NoiseFloorWord, GameStatus, GameType, RecipientType, ErrorResponse,
    JoinGameResponse, CreateShareTokenResponse,
    # Legacy aliases
    CreateGameRequest, CreateGameResponse,
    SubmitCluesRequest, SubmitCluesResponse,
    SubmitGuessesRequest, SubmitGuessesResponse,
)
from app.middleware.auth import get_authenticated_client
from app.services.embeddings import (
    get_noise_floor,
    check_word_in_vocabulary,
    get_sense_options,
    get_contextual_embedding,
)
from app.services.cache import EmbeddingCache, VocabularyPool
from app.services.scoring import (
    compute_divergence,
    compute_convergence,
    score_radiation,
    score_bridging,
    compute_bridge_similarity,
    bootstrap_null_distribution,
    normalize_scores,
)
from app.services.llm import llm_guess, haiku_build_bridge
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY, APP_URL
from supabase import create_client

router = APIRouter()

# ============================================
# HELPER FUNCTIONS
# ============================================

async def get_current_model_versions(supabase) -> dict:
    """Get current model version IDs from system_config."""
    config = supabase.table("system_config").select("key, value").execute()
    # JSONB values are auto-parsed by Supabase client, no need for json.loads
    config_dict = {row["key"]: row["value"] for row in config.data}

    # Get model version IDs
    embedding_model = config_dict.get("embedding_model", "text-embedding-3-small")
    llm_model = config_dict.get("llm_model", "claude-haiku-4-5-20251001")
    scoring_version = config_dict.get("scoring_version", "v3.1")

    # Look up UUIDs
    versions = supabase.table("model_versions").select("id, model_type, model_version").execute()
    version_map = {}
    for v in versions.data:
        if v["model_type"] == "embedding" and v["model_version"] == embedding_model:
            version_map["embedding_model_id"] = v["id"]
        elif v["model_type"] == "llm" and v["model_version"] == llm_model:
            version_map["llm_model_id"] = v["id"]

    version_map["scoring_version"] = scoring_version
    return version_map


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


def _extract_radiation_response(game: dict) -> RadiationGameResponse:
    """Extract radiation game response from unified game record."""
    setup = game.get("setup") or {}
    sender_input = game.get("sender_input") or {}
    recipient_input = game.get("recipient_input") or {}
    sender_scores = game.get("sender_scores") or {}
    recipient_scores = game.get("recipient_scores") or {}
    baselines = game.get("baselines") or {}

    return RadiationGameResponse(
        game_id=game["id"],
        game_type="radiation",
        sender_id=game["sender_id"],
        recipient_id=game.get("recipient_id"),
        recipient_type=game["recipient_type"],
        # Setup
        seed_word=setup.get("seed_word", ""),
        seed_word_sense=setup.get("seed_sense"),
        seed_in_vocabulary=setup.get("seed_in_vocabulary", True),
        noise_floor=[NoiseFloorWord(**w) for w in setup.get("noise_floor", [])],
        # Input
        clues=sender_input.get("clues"),
        guesses=recipient_input.get("guesses"),
        # Scores
        divergence=sender_scores.get("divergence"),
        divergence_score=sender_scores.get("divergence_raw"),
        convergence_score=recipient_scores.get("convergence"),
        relevance=sender_scores.get("relevance"),
        spread=sender_scores.get("spread", sender_scores.get("divergence")),  # Clues-only (fallback to divergence for old games)
        guess_similarities=recipient_scores.get("guess_similarities"),
        # Baselines
        llm_guesses=baselines.get("llm", {}).get("guesses"),
        llm_convergence=baselines.get("llm", {}).get("convergence"),
        # Status
        status=game["status"],
        created_at=game["created_at"],
        expires_at=game["expires_at"],
        completed_at=game.get("completed_at"),
        schema_version=game.get("schema_version", 1),
        scoring_version=game.get("scoring_version"),
    )


def _extract_bridging_response(game: dict) -> BridgingGameResponse:
    """Extract bridging game response from unified game record."""
    setup = game.get("setup") or {}
    sender_input = game.get("sender_input") or {}
    recipient_input = game.get("recipient_input") or {}
    sender_scores = game.get("sender_scores") or {}
    recipient_scores = game.get("recipient_scores") or {}
    baselines = game.get("baselines") or {}

    return BridgingGameResponse(
        game_id=game["id"],
        game_type="bridging",
        sender_id=game["sender_id"],
        recipient_id=game.get("recipient_id"),
        recipient_type=game["recipient_type"],
        # Setup
        anchor_word=setup.get("anchor_word", ""),
        target_word=setup.get("target_word", ""),
        # Sender
        clues=sender_input.get("clues"),
        relevance=sender_scores.get("relevance"),
        relevance_percentile=sender_scores.get("relevance_percentile"),
        divergence=sender_scores.get("divergence"),
        # Recipient
        recipient_clues=recipient_input.get("clues"),
        recipient_relevance=recipient_scores.get("relevance"),
        recipient_divergence=recipient_scores.get("divergence"),
        bridge_similarity=recipient_scores.get("bridge_similarity"),
        # Baselines
        haiku_clues=baselines.get("llm", {}).get("clues"),
        haiku_relevance=baselines.get("llm", {}).get("relevance"),
        haiku_divergence=baselines.get("llm", {}).get("divergence"),
        haiku_bridge_similarity=baselines.get("llm", {}).get("bridge_similarity"),
        lexical_bridge=baselines.get("lexical", {}).get("path"),
        lexical_relevance=baselines.get("lexical", {}).get("relevance"),
        lexical_divergence=baselines.get("lexical", {}).get("divergence"),
        # Status
        status=game["status"],
        share_code=setup.get("share_code"),
        created_at=game["created_at"],
        completed_at=game.get("completed_at"),
        expires_at=game["expires_at"],
        schema_version=game.get("schema_version", 1),
        scoring_version=game.get("scoring_version"),
    )


# ============================================
# RADIATION GAMES (INS-001.1)
# ============================================

@router.post("/radiation", response_model=CreateRadiationGameResponse)
async def create_radiation_game(
    request: CreateRadiationGameRequest,
    auth = Depends(get_authenticated_client)
):
    """
    Create a new radiation game.

    Seed word can be ANY word (not restricted to vocabulary).
    """
    supabase, user = auth
    seed_word = request.seed_word.lower().strip()

    # Check polysemy
    sense_options = get_sense_options(seed_word)
    if sense_options and not request.seed_word_sense:
        return CreateRadiationGameResponse(
            game_id="",
            seed_word=seed_word,
            noise_floor=[],
            status=GameStatus.PENDING_CLUES,
            is_polysemous=True,
            sense_options=sense_options
        )

    # Get noise floor and check vocabulary in parallel
    sense_context = request.seed_word_sense.split() if request.seed_word_sense else None

    noise_floor_task = get_noise_floor(
        supabase, seed_word, sense_context=sense_context, k=10
    )
    vocab_check_task = check_word_in_vocabulary(supabase, seed_word)
    model_versions_task = get_current_model_versions(supabase)

    noise_floor_data, seed_in_vocabulary, model_versions = await asyncio.gather(
        noise_floor_task, vocab_check_task, model_versions_task
    )

    # Build JSONB setup
    noise_floor = [{"word": w["word"], "similarity": w["similarity"]} for w in noise_floor_data]
    setup = {
        "seed_word": seed_word,
        "seed_sense": request.seed_word_sense,
        "seed_in_vocabulary": seed_in_vocabulary,
        "noise_floor": noise_floor,
    }

    # Create game
    result = supabase.table("games").insert({
        "schema_version": 1,
        "instrument_id": "INS-001",
        "game_type": "radiation",
        "sender_id": user["id"],
        "recipient_type": request.recipient_type.value,
        "embedding_model_id": model_versions.get("embedding_model_id"),
        "llm_model_id": model_versions.get("llm_model_id"),
        "scoring_version": model_versions.get("scoring_version"),
        "setup": setup,
        "status": "pending_clues"
    }).execute()

    game = result.data[0]

    return CreateRadiationGameResponse(
        game_id=game["id"],
        seed_word=seed_word,
        noise_floor=[NoiseFloorWord(**w) for w in noise_floor],
        status=GameStatus.PENDING_CLUES,
        seed_in_vocabulary=seed_in_vocabulary
    )


@router.get("/radiation/{game_id}", response_model=RadiationGameResponse)
async def get_radiation_game(
    game_id: str,
    auth = Depends(get_authenticated_client)
):
    """Get radiation game details."""
    supabase, user = auth

    try:
        result = supabase.table("games") \
            .select("*") \
            .eq("id", game_id) \
            .eq("game_type", "radiation") \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})

    return _extract_radiation_response(result.data)


@router.post("/radiation/{game_id}/clues", response_model=SubmitRadiationCluesResponse)
async def submit_radiation_clues(
    game_id: str,
    request: SubmitRadiationCluesRequest,
    auth = Depends(get_authenticated_client)
):
    """Submit clues for a radiation game."""
    supabase, user = auth
    clues_clean = [c.lower().strip() for c in request.clues]

    # Get game
    try:
        result = supabase.table("games") \
            .select("*") \
            .eq("id", game_id) \
            .eq("sender_id", user["id"]) \
            .eq("game_type", "radiation") \
            .eq("status", "pending_clues") \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})

    game = result.data
    setup = game.get("setup", {})
    seed_word = setup.get("seed_word", "")
    is_llm_game = game["recipient_type"] == "llm"

    cache = EmbeddingCache.get_instance()
    clue_context = ', '.join(clues_clean)

    # Get embeddings
    async def get_clue_embeddings():
        texts = [f"{c} (in context: {seed_word})" for c in clues_clean]
        texts.append(f"{seed_word} (in context: {clue_context})")
        return await cache.get_embeddings_batch(texts)

    async def get_floor_embeddings():
        floor_words = [fw["word"] for fw in setup.get("noise_floor", [])]
        floor_result = supabase.table("vocabulary_embeddings") \
            .select("word, embedding") \
            .in_("word", floor_words) \
            .execute()
        return [_parse_embedding(row["embedding"], row["word"])
                for row in floor_result.data if _parse_embedding(row["embedding"], row["word"])]

    # Parallel execution
    if is_llm_game:
        all_embeddings, floor_embeddings, llm_guesses = await asyncio.gather(
            get_clue_embeddings(),
            get_floor_embeddings(),
            llm_guess(clues_clean, num_guesses=3)
        )
    else:
        all_embeddings, floor_embeddings = await asyncio.gather(
            get_clue_embeddings(),
            get_floor_embeddings()
        )
        llm_guesses = None

    clue_embeddings = all_embeddings[:len(clues_clean)]
    seed_emb = all_embeddings[len(clues_clean)]

    # Score
    radiation_scores = score_radiation(clue_embeddings, seed_emb)
    divergence_raw = compute_divergence(clue_embeddings, floor_embeddings)

    # Compute relevance percentile using null distribution from in-memory pool
    # This normalizes scores against random word baseline
    vocab_pool = VocabularyPool.get_instance()
    vocab_with_emb = vocab_pool.get_random_with_embeddings(200)
    if vocab_with_emb:
        vocab_embeddings = [emb for _, emb in vocab_with_emb]
        null_dist = bootstrap_null_distribution(
            prompt_embeddings={"seed": seed_emb},
            vocabulary_embeddings=vocab_embeddings,
            n_clues=len(clues_clean),
            instrument="radiation",
            n_samples=100,
        )
        normalized = normalize_scores(radiation_scores, null_dist, method="percentile")
        relevance_percentile = normalized["relevance_normalized"]
    else:
        relevance_percentile = None

    # Build sender input with optional timing data
    sender_input = {"clues": clues_clean}
    if request.clue_timings:
        sender_input["clue_timings"] = [
            {"word": t.word, "first_entered_ms": t.first_entered_ms, "last_modified_ms": t.last_modified_ms}
            for t in request.clue_timings
        ]

    sender_scores = {
        "spread": radiation_scores["spread"],  # 0-100 clues-only (INS-001.1 primary)
        "divergence": radiation_scores["divergence"],  # 0-100 DAT-style (for comparison)
        "divergence_raw": divergence_raw,  # Legacy 0-1
        "relevance": radiation_scores["relevance"],
        "relevance_percentile": relevance_percentile,
    }

    update_data = {
        "sender_input": sender_input,
        "sender_scores": sender_scores,
        "status": "pending_guess"
    }

    # Handle LLM game completion
    convergence_score = None
    guess_similarities = None
    baselines = {}

    if is_llm_game and llm_guesses:
        guess_texts = [f"{g} (in context: {clue_context})" for g in llm_guesses]
        guess_embs = await cache.get_embeddings_batch(guess_texts)

        convergence_score, exact_match, guess_similarities = compute_convergence(
            seed_emb, guess_embs, seed_word, llm_guesses
        )

        update_data["recipient_input"] = {"guesses": llm_guesses}
        update_data["recipient_scores"] = {
            "convergence": convergence_score,
            "best_guess": llm_guesses[0] if llm_guesses else None,
            "guess_similarities": guess_similarities,
        }
        update_data["baselines"] = {
            "llm": {
                "guesses": llm_guesses,
                "convergence": convergence_score,
                "model": game.get("llm_model_id"),
            }
        }
        update_data["status"] = "completed"
        update_data["completed_at"] = "now()"

    supabase.table("games").update(update_data).eq("id", game_id).execute()

    return SubmitRadiationCluesResponse(
        game_id=game_id,
        clues=clues_clean,
        divergence=radiation_scores["divergence"],  # DAT-style (for comparison)
        divergence_score=divergence_raw,
        relevance=radiation_scores["relevance"],
        relevance_percentile=relevance_percentile,
        spread=radiation_scores["spread"],  # Clues-only (INS-001.1 primary metric)
        status=GameStatus.COMPLETED if is_llm_game else GameStatus.PENDING_GUESS,
        llm_guesses=llm_guesses,
        convergence_score=convergence_score,
        guess_similarities=guess_similarities
    )


@router.post("/radiation/{game_id}/guesses", response_model=SubmitRadiationGuessesResponse)
async def submit_radiation_guesses(
    game_id: str,
    request: SubmitRadiationGuessesRequest,
    auth = Depends(get_authenticated_client)
):
    """Submit guesses for a radiation game (human recipient)."""
    supabase, user = auth
    guesses_clean = [g.lower().strip() for g in request.guesses]

    try:
        result = supabase.table("games") \
            .select("*") \
            .eq("id", game_id) \
            .eq("recipient_id", user["id"]) \
            .eq("game_type", "radiation") \
            .eq("status", "pending_guess") \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})

    game = result.data
    setup = game.get("setup") or {}
    sender_input = game.get("sender_input") or {}
    seed_word = setup.get("seed_word", "")
    clues = sender_input.get("clues") or []

    # Compute convergence
    seed_emb = await get_contextual_embedding(seed_word, clues)
    guess_embs = [await get_contextual_embedding(g, clues) for g in guesses_clean]

    convergence_score, exact_match, guess_similarities = compute_convergence(
        seed_emb, guess_embs, seed_word, guesses_clean
    )

    # Update game
    supabase.table("games").update({
        "recipient_input": {"guesses": guesses_clean},
        "recipient_scores": {
            "convergence": convergence_score,
            "best_guess": guesses_clean[0] if guesses_clean else None,
            "guess_similarities": guess_similarities,
        },
        "status": "completed",
        "completed_at": "now()"
    }).eq("id", game_id).execute()

    return SubmitRadiationGuessesResponse(
        game_id=game_id,
        guesses=guesses_clean,
        convergence_score=convergence_score,
        exact_match=exact_match,
        seed_word=seed_word,
        status=GameStatus.COMPLETED,
        guess_similarities=guess_similarities
    )


# ============================================
# BRIDGING GAMES (INS-001.2)
# ============================================

@router.post("/bridging", response_model=CreateBridgingGameResponse)
async def create_bridging_game(
    request: CreateBridgingGameRequest,
    auth = Depends(get_authenticated_client)
):
    """Create a new bridging game."""
    supabase, user = auth
    anchor = request.anchor_word.lower().strip()
    target = request.target_word.lower().strip()

    if anchor == target:
        raise HTTPException(status_code=400, detail={"error": "Anchor and target must be different"})

    model_versions = await get_current_model_versions(supabase)

    setup = {
        "anchor_word": anchor,
        "target_word": target,
    }

    result = supabase.table("games").insert({
        "schema_version": 1,
        "instrument_id": "INS-001",
        "game_type": "bridging",
        "sender_id": user["id"],
        "recipient_type": request.recipient_type.value,
        "embedding_model_id": model_versions.get("embedding_model_id"),
        "llm_model_id": model_versions.get("llm_model_id"),
        "scoring_version": model_versions.get("scoring_version"),
        "setup": setup,
        "status": "pending_clues"
    }).execute()

    game = result.data[0]

    return CreateBridgingGameResponse(
        game_id=game["id"],
        anchor_word=anchor,
        target_word=target,
        status=GameStatus.PENDING_CLUES
    )


@router.get("/bridging/{game_id}", response_model=BridgingGameResponse)
async def get_bridging_game(
    game_id: str,
    auth = Depends(get_authenticated_client)
):
    """Get bridging game details."""
    supabase, user = auth

    try:
        result = supabase.table("games") \
            .select("*") \
            .eq("id", game_id) \
            .eq("game_type", "bridging") \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})

    return _extract_bridging_response(result.data)


@router.post("/bridging/{game_id}/clues", response_model=SubmitBridgingCluesResponse)
async def submit_bridging_clues(
    game_id: str,
    request: SubmitBridgingCluesRequest,
    auth = Depends(get_authenticated_client)
):
    """Submit clues for a bridging game."""
    supabase, user = auth
    clues_clean = [c.lower().strip() for c in request.clues]

    try:
        result = supabase.table("games") \
            .select("*") \
            .eq("id", game_id) \
            .eq("sender_id", user["id"]) \
            .eq("game_type", "bridging") \
            .eq("status", "pending_clues") \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})

    game = result.data
    setup = game.get("setup", {})
    anchor = setup.get("anchor_word", "")
    target = setup.get("target_word", "")
    is_llm_game = game["recipient_type"] == "llm"

    cache = EmbeddingCache.get_instance()

    # Get all embeddings
    async def get_all_embeddings():
        texts = [anchor, target] + clues_clean
        return await cache.get_embeddings_batch(texts)

    async def get_lexical_bridge():
        try:
            from app.services.scoring_bridging import find_lexical_union
            return await find_lexical_union(anchor, target, len(clues_clean), supabase)
        except Exception as e:
            print(f"Warning: find_lexical_union failed: {e}")
            return []  # Return empty list as fallback

    # Parallel execution
    if is_llm_game:
        all_embeddings, lexical_path, haiku_result = await asyncio.gather(
            get_all_embeddings(),
            get_lexical_bridge(),
            haiku_build_bridge(anchor, target, num_clues=len(clues_clean))
        )
        # Extract clues from haiku result dict
        haiku_clues = haiku_result.get("clues") if haiku_result else None
    else:
        all_embeddings, lexical_path = await asyncio.gather(
            get_all_embeddings(),
            get_lexical_bridge()
        )
        haiku_clues = None

    anchor_emb = all_embeddings[0]
    target_emb = all_embeddings[1]
    clue_embeddings = all_embeddings[2:]

    # Score sender's clues
    sender_scores_dict = score_bridging(clue_embeddings, anchor_emb, target_emb)

    # Compute relevance percentile using null distribution from in-memory pool
    # This normalizes scores against random word baseline
    vocab_pool = VocabularyPool.get_instance()
    vocab_with_emb = vocab_pool.get_random_with_embeddings(200)
    if vocab_with_emb:
        vocab_embeddings = [emb for _, emb in vocab_with_emb]
        null_dist = bootstrap_null_distribution(
            prompt_embeddings={"anchor": anchor_emb, "target": target_emb},
            vocabulary_embeddings=vocab_embeddings,
            n_clues=len(clues_clean),
            instrument="union",
            n_samples=100,
        )
        normalized = normalize_scores(sender_scores_dict, null_dist, method="percentile")
        relevance_percentile = normalized["relevance_normalized"]
    else:
        relevance_percentile = None

    # Build sender input with optional timing data
    sender_input = {"clues": clues_clean}
    if request.clue_timings:
        sender_input["clue_timings"] = [
            {"word": t.word, "first_entered_ms": t.first_entered_ms, "last_modified_ms": t.last_modified_ms}
            for t in request.clue_timings
        ]

    sender_scores = {
        "relevance": sender_scores_dict["relevance"],
        "relevance_percentile": relevance_percentile,
        "divergence": sender_scores_dict["divergence"],
    }

    # Build baselines
    baselines = {}

    # Lexical baseline
    print(f"[submit_bridging_clues] lexical_path = {lexical_path}")
    if lexical_path:
        lexical_embs = await cache.get_embeddings_batch(lexical_path)
        lexical_scores = score_bridging(lexical_embs, anchor_emb, target_emb)
        baselines["lexical"] = {
            "path": lexical_path,
            "relevance": lexical_scores["relevance"],
            "divergence": lexical_scores["divergence"],
        }
        print(f"[submit_bridging_clues] lexical baseline built: {baselines['lexical']}")
    else:
        print(f"[submit_bridging_clues] No lexical_path, skipping lexical baseline")

    # Generate share code
    import secrets
    share_code = secrets.token_hex(4)

    update_data = {
        "sender_input": sender_input,
        "sender_scores": sender_scores,
        "baselines": baselines,
        "setup": {**setup, "share_code": share_code},
        "status": "pending_guess"
    }

    # Handle LLM game
    haiku_relevance = None
    haiku_divergence = None
    haiku_bridge_similarity = None

    if is_llm_game and haiku_clues:
        haiku_embs = await cache.get_embeddings_batch(haiku_clues)
        haiku_scores = score_bridging(haiku_embs, anchor_emb, target_emb)
        haiku_bridge_similarity = compute_bridge_similarity(clue_embeddings, haiku_embs)

        baselines["llm"] = {
            "clues": haiku_clues,
            "relevance": haiku_scores["relevance"],
            "divergence": haiku_scores["divergence"],
            "bridge_similarity": haiku_bridge_similarity,
            "model": game.get("llm_model_id"),
        }

        haiku_relevance = haiku_scores["relevance"]
        haiku_divergence = haiku_scores["divergence"]

        update_data["baselines"] = baselines
        update_data["status"] = "completed"
        update_data["completed_at"] = "now()"

    supabase.table("games").update(update_data).eq("id", game_id).execute()

    return SubmitBridgingCluesResponse(
        game_id=game_id,
        clues=clues_clean,
        relevance=sender_scores["relevance"],
        relevance_percentile=sender_scores.get("relevance_percentile"),
        divergence=sender_scores["divergence"],
        lexical_bridge=baselines.get("lexical", {}).get("path"),
        lexical_relevance=baselines.get("lexical", {}).get("relevance"),
        lexical_divergence=baselines.get("lexical", {}).get("divergence"),
        haiku_clues=haiku_clues,
        haiku_relevance=haiku_relevance,
        haiku_divergence=haiku_divergence,
        haiku_bridge_similarity=haiku_bridge_similarity,
        status=GameStatus.COMPLETED if is_llm_game else GameStatus.PENDING_GUESS,
        share_code=share_code if not is_llm_game else None
    )


@router.post("/bridging/{game_id}/bridge", response_model=SubmitBridgingBridgeResponse)
async def submit_bridging_bridge(
    game_id: str,
    request: SubmitBridgingBridgeRequest,
    auth = Depends(get_authenticated_client)
):
    """Submit recipient's bridge (V2: bridge-vs-bridge)."""
    supabase, user = auth
    clues_clean = [c.lower().strip() for c in request.clues]

    print(f"submit_bridging_bridge: START - game_id={game_id}, user_id={user['id']}")

    # Use service client to debug (bypasses RLS)
    try:
        service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        debug_result = service_client.table("games") \
            .select("id, sender_id, recipient_id, status, game_type") \
            .eq("id", game_id) \
            .single() \
            .execute()
        if debug_result.data:
            print(f"submit_bridging_bridge: Game state (service) = {debug_result.data}")
            print(f"submit_bridging_bridge: recipient_id match? {debug_result.data.get('recipient_id')} == {user['id']} = {debug_result.data.get('recipient_id') == user['id']}")
            print(f"submit_bridging_bridge: status is pending_guess? {debug_result.data.get('status')} == 'pending_guess' = {debug_result.data.get('status') == 'pending_guess'}")
        else:
            print(f"submit_bridging_bridge: Game {game_id} not found even with service client!")
    except Exception as e:
        print(f"submit_bridging_bridge: Service debug query failed: {e}")

    # Now try with user's client (subject to RLS)
    # Accept games in "pending_guess" status OR "completed" status without recipient_input
    # (LLM games are marked completed after sender clues, but human recipient can still join and submit)
    try:
        print(f"submit_bridging_bridge: Querying with user client...")
        result = supabase.table("games") \
            .select("*") \
            .eq("id", game_id) \
            .eq("recipient_id", user["id"]) \
            .eq("game_type", "bridging") \
            .single() \
            .execute()
        print(f"submit_bridging_bridge: User query succeeded, got data: {result.data is not None}")

        # Validate game state
        if result.data:
            status = result.data.get("status")
            recipient_input = result.data.get("recipient_input")

            # Allow pending_guess OR completed-without-recipient-input
            if status == "pending_guess":
                print(f"submit_bridging_bridge: Game is pending_guess, allowing submission")
            elif status == "completed" and not recipient_input:
                print(f"submit_bridging_bridge: Game is completed but no recipient input yet, allowing submission")
            else:
                print(f"submit_bridging_bridge: Invalid state - status={status}, has_recipient_input={recipient_input is not None}")
                raise HTTPException(status_code=400, detail={"error": "Game already has recipient input or is in wrong state"})
    except APIError as e:
        print(f"submit_bridging_bridge: User query failed with APIError: {e}")
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})

    game = result.data
    setup = game.get("setup") or {}
    sender_input = game.get("sender_input") or {}
    sender_scores = game.get("sender_scores") or {}
    baselines = game.get("baselines") or {}
    anchor = setup.get("anchor_word", "")
    target = setup.get("target_word", "")
    sender_clues = sender_input.get("clues") or []

    cache = EmbeddingCache.get_instance()

    # Get embeddings
    all_texts = [anchor, target] + clues_clean + sender_clues
    all_embs = await cache.get_embeddings_batch(all_texts)

    anchor_emb = all_embs[0]
    target_emb = all_embs[1]
    recipient_embs = all_embs[2:2+len(clues_clean)]
    sender_embs = all_embs[2+len(clues_clean):]

    # Score recipient's bridge
    recipient_scores_dict = score_bridging(recipient_embs, anchor_emb, target_emb)
    bridge_sim = compute_bridge_similarity(sender_embs, recipient_embs)

    # Build recipient input with optional timing data
    recipient_input = {"clues": clues_clean}
    if request.clue_timings:
        recipient_input["clue_timings"] = [
            {"word": t.word, "first_entered_ms": t.first_entered_ms, "last_modified_ms": t.last_modified_ms}
            for t in request.clue_timings
        ]

    # Update game
    supabase.table("games").update({
        "recipient_input": recipient_input,
        "recipient_scores": {
            "relevance": recipient_scores_dict["relevance"],
            "divergence": recipient_scores_dict["divergence"],
            "bridge_similarity": bridge_sim,
        },
        "status": "completed",
        "completed_at": "now()"
    }).eq("id", game_id).execute()

    return SubmitBridgingBridgeResponse(
        game_id=game_id,
        recipient_clues=clues_clean,
        recipient_relevance=recipient_scores_dict["relevance"],
        recipient_divergence=recipient_scores_dict["divergence"],
        sender_clues=sender_clues,
        sender_relevance=sender_scores.get("relevance", 0),
        sender_divergence=sender_scores.get("divergence", 0),
        bridge_similarity=bridge_sim,
        haiku_clues=baselines.get("llm", {}).get("clues"),
        haiku_relevance=baselines.get("llm", {}).get("relevance"),
        haiku_divergence=baselines.get("llm", {}).get("divergence"),
        lexical_bridge=baselines.get("lexical", {}).get("path"),
        lexical_relevance=baselines.get("lexical", {}).get("relevance"),
        lexical_divergence=baselines.get("lexical", {}).get("divergence"),
        anchor_word=anchor,
        target_word=target,
        status=GameStatus.COMPLETED
    )


# ============================================
# LEGACY ROUTES (backwards compatibility)
# ============================================

# These routes maintain the old API contract for existing clients

@router.post("/", response_model=CreateGameResponse)
async def create_game(
    request: CreateGameRequest,
    auth = Depends(get_authenticated_client)
):
    """Legacy: Create radiation game via old endpoint."""
    return await create_radiation_game(request, auth)


@router.get("/{game_id}", response_model=RadiationGameResponse)
async def get_game(
    game_id: str,
    auth = Depends(get_authenticated_client)
):
    """Legacy: Get game (auto-detect type)."""
    supabase, user = auth

    try:
        result = supabase.table("games") \
            .select("*") \
            .eq("id", game_id) \
            .single() \
            .execute()
    except APIError:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})

    game = result.data
    if game["game_type"] == "bridging":
        # Return bridging response (caller should use /bridging/{id} endpoint)
        raise HTTPException(
            status_code=400,
            detail={"error": "Use /bridging/{game_id} for bridging games"}
        )

    return _extract_radiation_response(game)


@router.post("/{game_id}/clues", response_model=SubmitCluesResponse)
async def submit_clues(
    game_id: str,
    request: SubmitCluesRequest,
    auth = Depends(get_authenticated_client)
):
    """Legacy: Submit clues for radiation game."""
    return await submit_radiation_clues(game_id, request, auth)


@router.post("/{game_id}/guesses", response_model=SubmitGuessesResponse)
async def submit_guesses(
    game_id: str,
    request: SubmitGuessesRequest,
    auth = Depends(get_authenticated_client)
):
    """Legacy: Submit guesses for radiation game."""
    return await submit_radiation_guesses(game_id, request, auth)
