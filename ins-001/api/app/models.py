"""
API Models - INS-001 Semantic Associations

DO NOT MODIFY FIELD NAMES - these are the exact API contract.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


# ============================================
# ENUMS
# ============================================

class RecipientType(str, Enum):
    NETWORK = "network"
    STRANGER = "stranger"
    LLM = "llm"


class GameStatus(str, Enum):
    PENDING_CLUES = "pending_clues"
    PENDING_GUESS = "pending_guess"
    COMPLETED = "completed"
    EXPIRED = "expired"


# ============================================
# EMBEDDINGS
# ============================================

class NoiseFloorWord(BaseModel):
    """Single word in noise floor with similarity score."""
    word: str
    similarity: float = Field(ge=0, le=1)


class NoiseFloorRequest(BaseModel):
    """Request to generate noise floor for a seed word."""
    seed_word: str = Field(min_length=1, max_length=50)
    sense_context: Optional[list[str]] = None  # For polysemous words


class NoiseFloorResponse(BaseModel):
    """Response with noise floor words."""
    seed_word: str
    words: list[NoiseFloorWord]
    is_polysemous: bool = False
    sense_options: Optional[list[str]] = None  # If polysemous, available senses


class ValidateWordRequest(BaseModel):
    """Request to validate a word exists in vocabulary."""
    word: str


class ValidateWordResponse(BaseModel):
    """Response indicating if word is valid."""
    word: str
    valid: bool


# ============================================
# GAMES
# ============================================

class CreateGameRequest(BaseModel):
    """Request to create a new game."""
    # Seed word: any word allowed (blocklist checked at route level)
    # Only enforce length limits, not vocabulary membership
    seed_word: str = Field(
        min_length=1, 
        max_length=50,
        description="The target word. Can be any word, not just vocabulary."
    )
    seed_word_sense: Optional[str] = None  # For polysemous words: "flying mammal"
    recipient_type: RecipientType


class CreateGameResponse(BaseModel):
    """Response after creating a game."""
    game_id: str
    seed_word: str
    noise_floor: list[NoiseFloorWord]
    status: GameStatus
    # For polysemous words - if set, game not created yet
    is_polysemous: bool = False
    sense_options: Optional[list[str]] = None
    # For analytics
    seed_in_vocabulary: Optional[bool] = None


class SubmitCluesRequest(BaseModel):
    """Request to submit clues for a game."""
    clues: list[str] = Field(min_length=1, max_length=10)


class SubmitCluesResponse(BaseModel):
    """Response after submitting clues."""
    game_id: str
    clues: list[str]
    divergence_score: float
    status: GameStatus
    # If LLM game, includes LLM guesses immediately
    llm_guesses: Optional[list[str]] = None
    convergence_score: Optional[float] = None


class SubmitGuessesRequest(BaseModel):
    """Request to submit guesses (human recipient)."""
    guesses: list[str] = Field(min_length=1, max_length=5)


class SubmitGuessesResponse(BaseModel):
    """Response after submitting guesses."""
    game_id: str
    guesses: list[str]
    convergence_score: float
    exact_match: bool
    seed_word: str  # Revealed here AFTER guessing (security fix)
    status: GameStatus


class GameResponse(BaseModel):
    """Full game state."""
    game_id: str
    sender_id: str
    recipient_id: Optional[str]
    recipient_type: RecipientType
    seed_word: str
    seed_word_sense: Optional[str]
    seed_in_vocabulary: bool  # Whether seed was in vocabulary at creation
    noise_floor: list[NoiseFloorWord]
    clues: Optional[list[str]]
    guesses: Optional[list[str]]
    divergence_score: Optional[float]
    convergence_score: Optional[float]
    status: GameStatus
    created_at: datetime
    expires_at: datetime


# ============================================
# SHARING
# ============================================

class CreateShareTokenRequest(BaseModel):
    """Request to create a share token for a game."""
    pass  # game_id is in URL path


class CreateShareTokenResponse(BaseModel):
    """Response with share token."""
    token: str
    expires_at: datetime
    share_url: str  # Full URL for sharing


class JoinGameRequest(BaseModel):
    """Request to join a game via token."""
    pass  # token is in URL path


class JoinGameResponse(BaseModel):
    """Response after joining a game."""
    game_id: str
    clues: list[str]
    noise_floor: list[NoiseFloorWord]  # Keep for context
    sender_display_name: Optional[str]
    # seed_word: REMOVED - revealed after guessing (security fix)


# ============================================
# USERS / PROFILES
# ============================================

class UserResponse(BaseModel):
    """Current user info."""
    user_id: str
    display_name: Optional[str]
    is_anonymous: bool
    games_played: int
    profile_ready: bool
    created_at: datetime


class AcceptTermsRequest(BaseModel):
    """Request to accept terms (anonymous users)."""
    accepted: bool = True


class ProfileResponse(BaseModel):
    """Cognitive profile."""
    user_id: str
    
    divergence_mean: Optional[float]
    divergence_std: Optional[float]
    divergence_n: int
    
    network_convergence_mean: Optional[float]
    network_convergence_n: int
    
    stranger_convergence_mean: Optional[float]
    stranger_convergence_n: int
    
    llm_convergence_mean: Optional[float]
    llm_convergence_n: int
    
    semantic_portability: Optional[float]
    consistency_score: Optional[float]
    archetype: Optional[str]
    
    profile_ready: bool
    games_until_ready: int  # How many more games needed


# ============================================
# ERRORS
# ============================================

class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    detail: Optional[str] = None
