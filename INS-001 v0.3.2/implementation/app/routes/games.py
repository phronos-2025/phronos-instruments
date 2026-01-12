"""
Games Routes - INS-001 Semantic Associations

Handles game CRUD operations.
"""

from fastapi import APIRouter, HTTPException, Depends
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
    validate_word,
    validate_words,
    is_polysemous,
    get_sense_options,
    get_embedding,
    get_embeddings_batch,
    get_contextual_embedding,
)
from app.services.scoring import compute_divergence, compute_convergence
from app.services.llm import llm_guess
from app.config import is_blocked_word

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
    
    # 3. Track whether seed is in vocabulary (for analytics, NOT blocking)
    seed_in_vocabulary = await check_word_in_vocabulary(supabase, seed_word)
    
    # 4. Generate noise floor (works for ANY word now)
    sense_context = None
    if request.seed_word_sense:
        sense_context = request.seed_word_sense.split()
    
    noise_floor_data = await get_noise_floor(
        supabase,
        seed_word,
        sense_context=sense_context,
        k=20
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
    
    result = supabase.table("games") \
        .select("*") \
        .eq("id", game_id) \
        .single() \
        .execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found"})
    
    game = result.data
    
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
        status=game["status"],
        created_at=game["created_at"],
        expires_at=game["expires_at"],
    )


# ============================================
# SUBMIT CLUES
# ============================================

@router.post("/{game_id}/clues", response_model=SubmitCluesResponse)
async def submit_clues(
    game_id: str,
    request: SubmitCluesRequest,
    auth = Depends(get_authenticated_client)
):
    """
    Submit clues for a game.
    
    CLUES MUST BE IN VOCABULARY - they go to LLM and need validation.
    """
    supabase, user = auth
    
    # 1. Validate clues against vocabulary (REQUIRED - clues go to LLM)
    all_valid, invalid = await validate_words(supabase, request.clues)
    if not all_valid:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Invalid clues",
                "detail": f"These words are not in vocabulary: {', '.join(invalid)}"
            }
        )
    
    # 2. Get game
    result = supabase.table("games") \
        .select("*") \
        .eq("id", game_id) \
        .eq("sender_id", user["id"]) \
        .eq("status", "pending_clues") \
        .single() \
        .execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})
    
    game = result.data
    
    # 3. Compute divergence score
    # Get contextual embeddings for clues (in context of seed word)
    clue_embeddings = []
    for clue in request.clues:
        emb = await get_contextual_embedding(clue.lower().strip(), [game["seed_word"]])
        clue_embeddings.append(emb)
    
    # Get floor embeddings
    floor_embeddings = []
    for floor_word in game["noise_floor"]:
        # Use stored vocabulary embedding (don't re-embed)
        word_result = supabase.table("vocabulary_embeddings") \
            .select("embedding") \
            .eq("word", floor_word["word"]) \
            .single() \
            .execute()
        if word_result.data:
            floor_embeddings.append(word_result.data["embedding"])
    
    divergence_score = compute_divergence(clue_embeddings, floor_embeddings)
    
    # 4. Update game with clues and divergence
    clues_clean = [c.lower().strip() for c in request.clues]
    
    update_data = {
        "clues": clues_clean,
        "divergence_score": divergence_score,
        "status": "pending_guess"
    }
    
    # 5. If LLM recipient, get LLM guesses immediately
    llm_guesses = None
    convergence_score = None
    
    if game["recipient_type"] == "llm":
        llm_guesses = await llm_guess(clues_clean, num_guesses=3)
        
        # Validate LLM guesses against vocabulary (they should be valid)
        valid_guesses = []
        for guess in llm_guesses:
            if await validate_word(supabase, guess):
                valid_guesses.append(guess)
        llm_guesses = valid_guesses or llm_guesses[:1]  # Fallback to first if none valid
        
        # Compute convergence for LLM guesses
        # CRITICAL: Use contextual embeddings with clues as context
        # This ensures polysemous seeds are disambiguated correctly
        seed_emb = await get_contextual_embedding(game["seed_word"], clues_clean)
        guess_embs = [await get_contextual_embedding(g, clues_clean) for g in llm_guesses]
        
        convergence_score, exact_match = compute_convergence(
            seed_emb, guess_embs, game["seed_word"], llm_guesses
        )
        
        update_data["guesses"] = llm_guesses
        update_data["convergence_score"] = convergence_score
        update_data["status"] = "completed"
    
    supabase.table("games").update(update_data).eq("id", game_id).execute()
    
    return SubmitCluesResponse(
        game_id=game_id,
        clues=clues_clean,
        divergence_score=divergence_score,
        status=GameStatus.COMPLETED if llm_guesses else GameStatus.PENDING_GUESS,
        llm_guesses=llm_guesses,
        convergence_score=convergence_score
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
    
    GUESSES MUST BE IN VOCABULARY - they need reliable embeddings for scoring.
    """
    supabase, user = auth
    
    # 1. Validate guesses against vocabulary (REQUIRED for scoring)
    all_valid, invalid = await validate_words(supabase, request.guesses)
    if not all_valid:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Invalid guesses",
                "detail": f"These words are not in vocabulary: {', '.join(invalid)}"
            }
        )
    
    # 2. Get game (user must be recipient)
    result = supabase.table("games") \
        .select("*") \
        .eq("id", game_id) \
        .eq("recipient_id", user["id"]) \
        .eq("status", "pending_guess") \
        .single() \
        .execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Game not found or not in correct state"})
    
    game = result.data
    
    # 3. Compute convergence score
    guesses_clean = [g.lower().strip() for g in request.guesses]
    
    # CRITICAL: Use contextual embeddings with clues as context
    # This ensures polysemous seeds are disambiguated correctly
    clues = game["clues"]
    seed_emb = await get_contextual_embedding(game["seed_word"], clues)
    guess_embs = [await get_contextual_embedding(g, clues) for g in guesses_clean]
    
    convergence_score, exact_match = compute_convergence(
        seed_emb, guess_embs, game["seed_word"], guesses_clean
    )
    
    # 4. Update game
    supabase.table("games").update({
        "guesses": guesses_clean,
        "convergence_score": convergence_score,
        "status": "completed"
    }).eq("id", game_id).execute()
    
    return SubmitGuessesResponse(
        game_id=game_id,
        guesses=guesses_clean,
        convergence_score=convergence_score,
        exact_match=exact_match,
        status=GameStatus.COMPLETED
    )
