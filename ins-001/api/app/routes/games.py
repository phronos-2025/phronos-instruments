"""
Games Routes - INS-001 Semantic Associations

Handles game CRUD operations.
"""

import asyncio
import json
from fastapi import APIRouter, HTTPException, Depends
from postgrest.exceptions import APIError
from app.models import (
    CreateGameRequest, CreateGameResponse,
    SubmitCluesRequest, SubmitCluesResponse,
    SubmitGuessesRequest, SubmitGuessesResponse,
    GameResponse, NoiseFloorWord, GameStatus, ErrorResponse
)
from app.middleware.auth import get_authenticated_client
from app.services.embeddings import (
    get_noise_floor,
    check_word_in_vocabulary,
    is_polysemous,
    get_sense_options,
    get_embedding,
    get_embeddings_batch,
    get_contextual_embedding,
)
# Performance optimization: Use cached embeddings
from app.services.cache import EmbeddingCache
from app.services.scoring import compute_divergence, compute_convergence, score_radiation
from app.services.llm import llm_guess
from app.services.profiles import update_user_profile
from app.config import is_blocked_word, SUPABASE_URL, SUPABASE_SERVICE_KEY
from supabase import create_client

router = APIRouter()


# ============================================
# CREATE GAME
# ============================================

@router.post("/", response_model=CreateGameResponse)
async def create_game(
    request: CreateGameRequest,
    auth = Depends(get_authenticated_client)
):
    """
    Create a new game.
    
    Seed word can be ANY word (not restricted to vocabulary).
    - Domain-specific terms: allowed
    - Proper nouns: allowed
    - Slang/neologisms: allowed
    - Made-up words: allowed (will have weak noise floor)
    
    MVP: No restrictions on seed words.
    """
    supabase, user = auth
    seed_word = request.seed_word.lower().strip()
    
    # MVP: Blocklist disabled (no clear benefit for private games)
    # Uncomment to enable content filtering:
    # if is_blocked_word(seed_word):
    #     raise HTTPException(
    #         status_code=400,
    #         detail={"error": "Word not allowed", "detail": "This word cannot be used as a seed."}
    #     )
    
    # 2. Check polysemy (only for known polysemous words in vocabulary)
    sense_options = get_sense_options(seed_word)
    if sense_options and not request.seed_word_sense:
        # Return options for disambiguation - game not created yet
        return CreateGameResponse(
            game_id="",
            seed_word=seed_word,
            noise_floor=[],
            status=GameStatus.PENDING_CLUES,
            is_polysemous=True,
            sense_options=sense_options
        )
    
    # 3. Generate noise floor and check vocabulary in parallel
    sense_context = None
    if request.seed_word_sense:
        sense_context = request.seed_word_sense.split()

    noise_floor_task = get_noise_floor(
        supabase,
        seed_word,
        sense_context=sense_context,
        k=10  # Top 10 predictable associations
    )
    vocab_check_task = check_word_in_vocabulary(supabase, seed_word)

    noise_floor_data, seed_in_vocabulary = await asyncio.gather(
        noise_floor_task, vocab_check_task
    )
    
    # 5. Create game record
    noise_floor = [
        {"word": w["word"], "similarity": w["similarity"]}
        for w in noise_floor_data
    ]
    
    result = supabase.table("games").insert({
        "sender_id": user["id"],
        "recipient_type": request.recipient_type.value,
        "seed_word": seed_word,
        "seed_word_sense": request.seed_word_sense,
        "seed_in_vocabulary": seed_in_vocabulary,
        "noise_floor": noise_floor,
        "status": "pending_clues"
    }).execute()
    
    game = result.data[0]
    
    return CreateGameResponse(
        game_id=game["id"],
        seed_word=game["seed_word"],
        noise_floor=[NoiseFloorWord(**w) for w in noise_floor],
        status=GameStatus.PENDING_CLUES,
        seed_in_vocabulary=seed_in_vocabulary
    )


# ============================================
# GET GAME
# ============================================

@router.get("/{game_id}", response_model=GameResponse)
async def get_game(
    game_id: str,
    auth = Depends(get_authenticated_client)
):
    """Get game details. RLS ensures user can only see their own games."""
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
    
    # Calculate guess similarities if guesses exist but similarities aren't stored
    guess_similarities = game.get("guess_similarities")
    
    if not guess_similarities and game.get("guesses") and game.get("clues") and game.get("convergence_score") is not None:
        # Recalculate similarities for display (uses cached embeddings)
        try:
            cache = EmbeddingCache.get_instance()
            seed_emb = await cache.get_contextual_embedding(game["seed_word"], game["clues"])
            guess_embs = [await cache.get_contextual_embedding(g, game["clues"]) for g in game["guesses"]]
            _, _, guess_similarities = compute_convergence(
                seed_emb, guess_embs, game["seed_word"], game["guesses"]
            )
        except Exception as e:
            # If embedding fails, just return None
            print(f"Warning: Could not calculate guess similarities: {e}")
            guess_similarities = None
    
    return GameResponse(
        game_id=game["id"],
        sender_id=game["sender_id"],
        recipient_id=game.get("recipient_id"),
        recipient_type=game["recipient_type"],
        seed_word=game["seed_word"],
        seed_word_sense=game.get("seed_word_sense"),
        seed_in_vocabulary=game.get("seed_in_vocabulary", True),
        noise_floor=[NoiseFloorWord(**w) for w in game["noise_floor"]],
        clues=game.get("clues"),
        guesses=game.get("guesses"),
        divergence_score=game.get("divergence_score"),
        convergence_score=game.get("convergence_score"),
        relevance=game.get("relevance"),
        spread=game.get("spread"),
        guess_similarities=guess_similarities,
        status=game["status"],
        created_at=game["created_at"],
        expires_at=game["expires_at"],
    )


# ============================================
# SUBMIT CLUES
# ============================================

def _parse_embedding(embedding, word: str) -> list[float] | None:
    """Parse embedding from various formats returned by Supabase."""
    if isinstance(embedding, str):
        # Try JSON first (most common format)
        try:
            embedding = json.loads(embedding)
        except (json.JSONDecodeError, ValueError):
            # If not JSON, try parsing as space/comma-separated values
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


@router.post("/{game_id}/clues", response_model=SubmitCluesResponse)
async def submit_clues(
    game_id: str,
    request: SubmitCluesRequest,
    auth = Depends(get_authenticated_client)
):
    """
    Submit clues for a game.

    Clues can be ANY word - XML escaping handles LLM prompt safety.
    """
    supabase, user = auth

    # Clean clues (no vocabulary validation - accept any word)
    clues_clean = [c.lower().strip() for c in request.clues]

    # Get game
    try:
        result = supabase.table("games") \
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
    cache = EmbeddingCache.get_instance()
    is_llm_game = game["recipient_type"] == "llm"
    seed_word = game["seed_word"]
    clue_context = ', '.join(clues_clean)

    # OPTIMIZATION: Batch ALL embeddings we'll need upfront
    # For LLM games, include seed embedding (we know it before LLM responds)
    async def get_all_embeddings():
        texts = [f"{clue} (in context: {seed_word})" for clue in clues_clean]
        if is_llm_game:
            # Pre-embed seed word for convergence calculation
            texts.append(f"{seed_word} (in context: {clue_context})")
        return await cache.get_embeddings_batch(texts)

    async def get_floor_embeddings():
        floor_words = [fw["word"] for fw in game["noise_floor"]]
        floor_result = supabase.table("vocabulary_embeddings") \
            .select("word, embedding") \
            .in_("word", floor_words) \
            .execute()
        embeddings = []
        if floor_result.data:
            for row in floor_result.data:
                parsed = _parse_embedding(row["embedding"], row["word"])
                if parsed:
                    embeddings.append(parsed)
        return embeddings

    # Run everything we can in parallel
    # Always get seed embedding for new scoring system
    if is_llm_game:
        # All three in parallel: embeddings (clues + seed), floor fetch, LLM guesses
        all_embeddings, floor_embeddings, llm_guesses = await asyncio.gather(
            get_all_embeddings(),
            get_floor_embeddings(),
            llm_guess(clues_clean, num_guesses=3)
        )
        clue_embeddings = all_embeddings[:len(clues_clean)]
        seed_emb = all_embeddings[len(clues_clean)]
    else:
        # Embeddings (clues + seed) and floor fetch in parallel
        # We need seed embedding for the new scoring system
        async def get_clues_and_seed_embeddings():
            texts = [f"{c} (in context: {clue_context})" for c in clues_clean]
            texts.append(f"{seed_word} (in context: {clue_context})")
            return await cache.get_embeddings_batch(texts)

        all_embeddings, floor_embeddings = await asyncio.gather(
            get_clues_and_seed_embeddings(),
            get_floor_embeddings()
        )
        clue_embeddings = all_embeddings[:len(clues_clean)]
        seed_emb = all_embeddings[len(clues_clean)]
        llm_guesses = None

    # Use new scoring system: score_radiation returns relevance (0-1) and divergence (0-100)
    radiation_scores = score_radiation(clue_embeddings, seed_emb)
    relevance_score = radiation_scores["relevance"]  # 0-1 scale
    spread_score = radiation_scores["divergence"]    # 0-100 scale (DAT-style)

    # For backwards compatibility, also compute legacy divergence_score
    divergence_score = compute_divergence(clue_embeddings, floor_embeddings)

    update_data = {
        "clues": clues_clean,
        "divergence_score": divergence_score,  # Legacy: 0-1 scale
        "relevance": relevance_score,          # New: 0-1 scale
        "spread": spread_score,                # New: 0-100 scale (DAT-style)
        "status": "pending_guess"
    }

    # If LLM recipient, compute convergence score
    convergence_score = None
    guess_similarities = None

    if is_llm_game:
        # Only need to embed the guesses now (seed already embedded)
        guess_texts = [f"{g} (in context: {clue_context})" for g in llm_guesses]
        guess_embs = await cache.get_embeddings_batch(guess_texts)

        convergence_score, exact_match, guess_similarities = compute_convergence(
            seed_emb, guess_embs, seed_word, llm_guesses
        )

        update_data["guesses"] = llm_guesses
        update_data["convergence_score"] = convergence_score
        update_data["status"] = "completed"

    supabase.table("games").update(update_data).eq("id", game_id).execute()

    # Update profile for sender if game completed (fire-and-forget, don't block response)
    if is_llm_game and SUPABASE_SERVICE_KEY:
        async def update_profile_background():
            try:
                service_supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
                await update_user_profile(service_supabase, user["id"])
            except Exception:
                pass  # Profile update is non-critical
        asyncio.create_task(update_profile_background())

    return SubmitCluesResponse(
        game_id=game_id,
        clues=clues_clean,
        divergence_score=divergence_score,
        status=GameStatus.COMPLETED if llm_guesses else GameStatus.PENDING_GUESS,
        relevance=relevance_score,
        spread=spread_score,
        llm_guesses=llm_guesses,
        convergence_score=convergence_score,
        guess_similarities=guess_similarities
    )


# ============================================
# SUBMIT GUESSES (human recipient)
# ============================================

@router.post("/{game_id}/guesses", response_model=SubmitGuessesResponse)
async def submit_guesses(
    game_id: str,
    request: SubmitGuessesRequest,
    auth = Depends(get_authenticated_client)
):
    """
    Submit guesses for a game (human recipient only).
    
    Guesses can be ANY word - embedded on-demand via OpenAI.
    """
    supabase, user = auth
    
    # Clean guesses (no vocabulary validation - accept any word)
    guesses_clean = [g.lower().strip() for g in request.guesses]

    # Get game (user must be recipient)
    try:
        result = supabase.table("games") \
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
    
    # Compute convergence score
    # CRITICAL: Use contextual embeddings with clues as context
    # This ensures polysemous seeds are disambiguated correctly
    clues = game["clues"]
    seed_emb = await get_contextual_embedding(game["seed_word"], clues)
    guess_embs = [await get_contextual_embedding(g, clues) for g in guesses_clean]
    
    convergence_score, exact_match, guess_similarities = compute_convergence(
        seed_emb, guess_embs, game["seed_word"], guesses_clean
    )
    
    # 4. Update game
    supabase.table("games").update({
        "guesses": guesses_clean,
        "convergence_score": convergence_score,
        "status": "completed"
    }).eq("id", game_id).execute()
    
    # Update profiles for BOTH sender and recipient
    if SUPABASE_SERVICE_KEY:
        service_supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        await update_user_profile(service_supabase, game["sender_id"])
        await update_user_profile(service_supabase, user["id"])  # recipient
    
    return SubmitGuessesResponse(
        game_id=game_id,
        guesses=guesses_clean,
        convergence_score=convergence_score,
        exact_match=exact_match,
        seed_word=game["seed_word"],  # Reveal seed word after guessing (security fix)
        status=GameStatus.COMPLETED,
        guess_similarities=guess_similarities
    )
