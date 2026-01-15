"""
API Models - INS-001 Semantic Associations

Schema Version: 2.0 (JSONB-based unified games table)

This file defines the API contract. The internal JSONB structures are
flexible, but API responses maintain stable field names.
"""

from pydantic import BaseModel, Field
from typing import Optional, Any, List
from datetime import datetime
from enum import Enum


# ============================================
# ENUMS
# ============================================

class GameType(str, Enum):
    """Types of games within INS-001."""
    RADIATION = "radiation"
    BRIDGING = "bridging"


class RecipientType(str, Enum):
    """Who the game is played with."""
    NETWORK = "network"
    STRANGER = "stranger"
    LLM = "llm"


class GameStatus(str, Enum):
    """Game lifecycle status."""
    PENDING_CLUES = "pending_clues"
    PENDING_GUESS = "pending_guess"
    COMPLETED = "completed"
    EXPIRED = "expired"


# ============================================
# SHARED COMPONENTS
# ============================================

class NoiseFloorWord(BaseModel):
    """Single word in noise floor with similarity score."""
    word: str
    similarity: float = Field(ge=0, le=1)


class SenderScores(BaseModel):
    """Scores computed for sender's input."""
    divergence: float = Field(ge=0, le=100, description="DAT-style spread score (0-100)")
    divergence_raw: Optional[float] = Field(None, ge=0, le=1, description="Legacy 0-1 scale")
    relevance: Optional[float] = Field(None, ge=0, le=1, description="Mean similarity to anchors")
    relevance_percentile: Optional[float] = Field(None, ge=0, le=100)


class RecipientScores(BaseModel):
    """Scores computed for recipient's input."""
    convergence: Optional[float] = Field(None, ge=0, le=1, description="Best guess similarity")
    best_guess: Optional[str] = None
    similarity: Optional[float] = None
    # Bridging-specific
    relevance: Optional[float] = None
    divergence: Optional[float] = None
    bridge_similarity: Optional[float] = None


class BaselineScores(BaseModel):
    """Baseline comparison scores (LLM, lexical)."""
    llm: Optional[dict] = None  # {clues, guesses, convergence, relevance, divergence, model}
    lexical: Optional[dict] = None  # {path, relevance, divergence}


# ============================================
# EMBEDDINGS
# ============================================

class NoiseFloorRequest(BaseModel):
    """Request to generate noise floor for a seed word."""
    seed_word: str = Field(min_length=1, max_length=50)
    sense_context: Optional[list[str]] = None


class NoiseFloorResponse(BaseModel):
    """Response with noise floor words."""
    seed_word: str
    words: list[NoiseFloorWord]
    is_polysemous: bool = False
    sense_options: Optional[list[str]] = None


class ValidateWordRequest(BaseModel):
    """Request to validate a word exists in vocabulary."""
    word: str


class ValidateWordResponse(BaseModel):
    """Response indicating if word is valid."""
    word: str
    valid: bool


# ============================================
# RADIATION GAMES (INS-001.1)
# ============================================

class CreateRadiationGameRequest(BaseModel):
    """Request to create a radiation game."""
    seed_word: str = Field(min_length=1, max_length=50)
    seed_word_sense: Optional[str] = None
    recipient_type: RecipientType


class CreateRadiationGameResponse(BaseModel):
    """Response after creating a radiation game."""
    game_id: str
    seed_word: str
    noise_floor: list[NoiseFloorWord]
    status: GameStatus
    is_polysemous: bool = False
    sense_options: Optional[list[str]] = None
    seed_in_vocabulary: Optional[bool] = None


class SubmitRadiationCluesRequest(BaseModel):
    """Request to submit clues for a radiation game."""
    clues: list[str] = Field(min_length=1, max_length=10)


class SubmitRadiationCluesResponse(BaseModel):
    """Response after submitting radiation clues."""
    game_id: str
    clues: list[str]
    # Scores
    divergence: float  # 0-100 DAT-style
    divergence_score: float  # Legacy 0-1 for backwards compat
    relevance: Optional[float] = None
    spread: Optional[float] = None
    status: GameStatus
    # LLM results (if LLM game)
    llm_guesses: Optional[list[str]] = None
    convergence_score: Optional[float] = None
    guess_similarities: Optional[list[float]] = None


class SubmitRadiationGuessesRequest(BaseModel):
    """Request to submit guesses (human recipient)."""
    guesses: list[str] = Field(min_length=1, max_length=5)


class SubmitRadiationGuessesResponse(BaseModel):
    """Response after submitting guesses."""
    game_id: str
    guesses: list[str]
    convergence_score: float
    exact_match: bool
    seed_word: str  # Revealed AFTER guessing
    status: GameStatus
    guess_similarities: Optional[list[float]] = None


class RadiationGameResponse(BaseModel):
    """Full radiation game state."""
    game_id: str
    game_type: str = "radiation"
    sender_id: str
    recipient_id: Optional[str]
    recipient_type: RecipientType
    # Setup
    seed_word: str
    seed_word_sense: Optional[str]
    seed_in_vocabulary: bool
    noise_floor: list[NoiseFloorWord]
    # Input
    clues: Optional[list[str]]
    guesses: Optional[list[str]]
    # Scores
    divergence: Optional[float] = None  # 0-100 DAT-style
    divergence_score: Optional[float] = None  # Legacy 0-1
    convergence_score: Optional[float] = None
    relevance: Optional[float] = None
    spread: Optional[float] = None
    guess_similarities: Optional[list[float]] = None
    # Baselines
    llm_guesses: Optional[list[str]] = None
    llm_convergence: Optional[float] = None
    # Status
    status: GameStatus
    created_at: datetime
    expires_at: datetime
    completed_at: Optional[datetime] = None
    # Versioning
    schema_version: int = 1
    scoring_version: Optional[str] = None


# ============================================
# BRIDGING GAMES (INS-001.2)
# ============================================

class CreateBridgingGameRequest(BaseModel):
    """Request to create a bridging game."""
    anchor_word: str = Field(min_length=1, max_length=50)
    target_word: str = Field(min_length=1, max_length=50)
    recipient_type: RecipientType = RecipientType.LLM


class CreateBridgingGameResponse(BaseModel):
    """Response after creating a bridging game."""
    game_id: str
    anchor_word: str
    target_word: str
    status: GameStatus


class SubmitBridgingCluesRequest(BaseModel):
    """Request to submit clues for a bridging game."""
    clues: list[str] = Field(min_length=1, max_length=5)


class SubmitBridgingCluesResponse(BaseModel):
    """Response after submitting bridging clues."""
    game_id: str
    clues: list[str]
    # V3 unified scoring
    relevance: float  # 0-1: mean min(sim_anchor, sim_target) per clue
    relevance_percentile: Optional[float] = None  # 0-100: vs random baseline
    divergence: float  # 0-100: DAT-style spread
    # Baselines
    lexical_bridge: Optional[list[str]] = None
    lexical_relevance: Optional[float] = None
    lexical_divergence: Optional[float] = None
    # Haiku (if LLM recipient)
    haiku_clues: Optional[list[str]] = None
    haiku_relevance: Optional[float] = None
    haiku_divergence: Optional[float] = None
    haiku_bridge_similarity: Optional[float] = None
    # Status
    status: GameStatus
    share_code: Optional[str] = None


class SubmitBridgingBridgeRequest(BaseModel):
    """Request to submit recipient's bridge (V2: bridge-vs-bridge)."""
    clues: list[str] = Field(min_length=1, max_length=5)


class SubmitBridgingBridgeResponse(BaseModel):
    """Response after submitting recipient's bridge."""
    game_id: str
    # Recipient's bridge
    recipient_clues: list[str]
    recipient_relevance: float
    recipient_divergence: float
    # Sender's bridge (revealed)
    sender_clues: list[str]
    sender_relevance: float
    sender_divergence: float
    # Comparison
    bridge_similarity: float
    # Baselines
    haiku_clues: Optional[list[str]] = None
    haiku_relevance: Optional[float] = None
    haiku_divergence: Optional[float] = None
    lexical_bridge: Optional[list[str]] = None
    lexical_relevance: Optional[float] = None
    lexical_divergence: Optional[float] = None
    # Anchors
    anchor_word: str
    target_word: str
    status: GameStatus


class BridgingGameResponse(BaseModel):
    """Full bridging game state."""
    game_id: str
    game_type: str = "bridging"
    sender_id: str
    recipient_id: Optional[str]
    recipient_type: RecipientType
    # Setup
    anchor_word: str
    target_word: str
    # Sender input/scores
    clues: Optional[list[str]]
    relevance: Optional[float] = None
    relevance_percentile: Optional[float] = None
    divergence: Optional[float] = None
    # Recipient input/scores
    recipient_clues: Optional[list[str]] = None
    recipient_relevance: Optional[float] = None
    recipient_divergence: Optional[float] = None
    bridge_similarity: Optional[float] = None
    # Baselines
    haiku_clues: Optional[list[str]] = None
    haiku_relevance: Optional[float] = None
    haiku_divergence: Optional[float] = None
    haiku_bridge_similarity: Optional[float] = None
    lexical_bridge: Optional[list[str]] = None
    lexical_relevance: Optional[float] = None
    lexical_divergence: Optional[float] = None
    # Status
    status: GameStatus
    share_code: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    expires_at: datetime
    # Versioning
    schema_version: int = 1
    scoring_version: Optional[str] = None


# ============================================
# SHARING
# ============================================

class CreateShareTokenResponse(BaseModel):
    """Response with share token."""
    token: str
    expires_at: datetime
    share_url: str


class JoinGameResponse(BaseModel):
    """Response after joining a game via token."""
    game_id: str
    game_type: GameType
    # For radiation: clues + noise_floor (NOT seed_word)
    # For bridging: anchor + target + sender_clue_count
    clues: Optional[list[str]] = None
    noise_floor: Optional[list[NoiseFloorWord]] = None
    anchor_word: Optional[str] = None
    target_word: Optional[str] = None
    sender_clue_count: Optional[int] = None
    sender_display_name: Optional[str] = None


# ============================================
# SUGGESTIONS
# ============================================

class SuggestWordRequest(BaseModel):
    """Request to suggest a distant word."""
    from_word: Optional[str] = Field(default=None, max_length=50)


class SuggestWordResponse(BaseModel):
    """Response with suggested distant word."""
    suggestion: str
    from_word: Optional[str] = None


# ============================================
# USERS / PROFILES
# ============================================

class UserResponse(BaseModel):
    """Current user info."""
    user_id: str
    display_name: Optional[str]
    is_anonymous: bool
    email: Optional[str] = None
    games_played: int  # Computed from view
    profile_ready: bool  # Computed from view
    terms_accepted_at: Optional[datetime] = None
    created_at: datetime


class AcceptTermsRequest(BaseModel):
    """Request to accept terms."""
    accepted: bool = True


class ProfileResponse(BaseModel):
    """Cognitive profile (computed from view)."""
    user_id: str
    # Stats
    games_played: int
    divergence_mean: Optional[float]
    divergence_std: Optional[float]
    divergence_n: int
    # Convergence by recipient type
    network_convergence_mean: Optional[float]
    network_games: int
    stranger_convergence_mean: Optional[float]
    stranger_games: int
    llm_convergence_mean: Optional[float]
    llm_games: int
    # Game type breakdown
    radiation_games: int
    bridging_games: int
    # Derived metrics
    semantic_portability: Optional[float]
    consistency_score: Optional[float]
    archetype: Optional[str]
    # Status
    profile_ready: bool
    games_until_ready: int


class GameHistoryItem(BaseModel):
    """Single game in history list."""
    game_id: str
    game_type: str  # 'radiation' or 'bridging'
    # Seed/anchor info
    seed_word: Optional[str] = None  # For radiation
    anchor_word: Optional[str] = None  # For bridging
    target_word: Optional[str] = None  # For bridging
    # Scores
    divergence: Optional[float] = None
    relevance: Optional[float] = None
    convergence: Optional[float] = None
    # Meta
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None


class GameHistoryResponse(BaseModel):
    """Paginated game history."""
    games: List[GameHistoryItem]
    total: int
    limit: int
    offset: int


# ============================================
# SYSTEM / CONFIG
# ============================================

class InstrumentResponse(BaseModel):
    """Instrument info."""
    id: str
    name: str
    description: Optional[str]
    version: str
    config: Optional[dict] = None


class ModelVersionResponse(BaseModel):
    """Model version info."""
    id: str
    model_type: str
    model_name: str
    model_version: str
    config: Optional[dict] = None
    deprecated_at: Optional[datetime] = None


class SystemConfigResponse(BaseModel):
    """System configuration."""
    embedding_model: str
    llm_model: str
    scoring_version: str
    schema_version: int


# ============================================
# ERRORS
# ============================================

class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    detail: Optional[str] = None


# ============================================
# INTERNAL JSONB SCHEMAS (for documentation)
# ============================================

class RadiationSetup(BaseModel):
    """JSONB schema for radiation game setup."""
    seed_word: str
    seed_sense: Optional[str] = None
    seed_in_vocabulary: bool = True
    noise_floor: list[dict]  # [{word, similarity}]


class RadiationSenderInput(BaseModel):
    """JSONB schema for radiation sender input."""
    clues: list[str]


class RadiationRecipientInput(BaseModel):
    """JSONB schema for radiation recipient input."""
    guesses: list[str]


class BridgingSetup(BaseModel):
    """JSONB schema for bridging game setup."""
    anchor_word: str
    target_word: str


class BridgingSenderInput(BaseModel):
    """JSONB schema for bridging sender input."""
    clues: list[str]


class BridgingRecipientInput(BaseModel):
    """JSONB schema for bridging recipient input (V2: bridge-vs-bridge)."""
    clues: list[str]


# ============================================
# LEGACY ALIASES (for backwards compatibility)
# ============================================

# These aliases allow old code to continue working
CreateGameRequest = CreateRadiationGameRequest
CreateGameResponse = CreateRadiationGameResponse
SubmitCluesRequest = SubmitRadiationCluesRequest
SubmitCluesResponse = SubmitRadiationCluesResponse
SubmitGuessesRequest = SubmitRadiationGuessesRequest
SubmitGuessesResponse = SubmitRadiationGuessesResponse
GameResponse = RadiationGameResponse

# Bridging legacy aliases
BridgingRecipientType = RecipientType  # Was separate enum, now unified
BridgingGameStatus = GameStatus  # Was separate enum, now unified
