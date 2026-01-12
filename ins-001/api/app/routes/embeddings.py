"""
Embeddings Routes - INS-001 Semantic Associations

Handles embedding-related endpoints (noise floor, validation).
"""

from fastapi import APIRouter, HTTPException, Depends
from app.models import (
    NoiseFloorRequest,
    NoiseFloorResponse,
    ValidateWordRequest,
    ValidateWordResponse,
    NoiseFloorWord,
    ErrorResponse
)
from app.middleware.auth import get_authenticated_client
from app.services.embeddings import (
    get_noise_floor,
    validate_word,
    is_polysemous,
    get_sense_options
)

router = APIRouter()


@router.post("/floor", response_model=NoiseFloorResponse)
async def get_noise_floor_endpoint(
    request: NoiseFloorRequest,
    auth = Depends(get_authenticated_client)
):
    """
    Generate noise floor for a seed word.
    
    Works for ANY word (not just vocabulary):
    - Standard words
    - Domain-specific terms
    - Proper nouns
    - Slang/neologisms
    """
    supabase, user = auth
    
    # Check if polysemous
    polysemous = is_polysemous(request.seed_word)
    sense_options = get_sense_options(request.seed_word) if polysemous else None
    
    # Get noise floor
    floor_data = await get_noise_floor(
        supabase,
        request.seed_word,
        sense_context=request.sense_context,
        k=20
    )
    
    noise_floor = [
        NoiseFloorWord(word=item["word"], similarity=item["similarity"])
        for item in floor_data
    ]
    
    return NoiseFloorResponse(
        seed_word=request.seed_word,
        words=noise_floor,
        is_polysemous=polysemous,
        sense_options=sense_options
    )


@router.post("/validate", response_model=ValidateWordResponse)
async def validate_word_endpoint(
    request: ValidateWordRequest,
    auth = Depends(get_authenticated_client)
):
    """
    Validate if a word exists in vocabulary.
    
    USE FOR: Clues and guesses (NOT seed words)
    """
    supabase, user = auth
    
    valid = await validate_word(supabase, request.word)
    
    return ValidateWordResponse(
        word=request.word,
        valid=valid
    )
