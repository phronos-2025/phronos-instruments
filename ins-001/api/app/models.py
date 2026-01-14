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
    guess_similarities: Optional[list[float]] = None  # Semantic similarity for each guess


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
    guess_similarities: Optional[list[float]] = None  # Semantic similarity for each guess


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
    guess_similarities: Optional[list[float]] = None  # Semantic similarity for each guess
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


# ============================================
# INS-001.2: BRIDGING GAMES
# ============================================

class BridgingRecipientType(str, Enum):
    """Recipient types for bridging games."""
    HUMAN = "human"
    HAIKU = "haiku"


class BridgingGameStatus(str, Enum):
    """Game status for bridging games."""
    PENDING_CLUES = "pending_clues"
    PENDING_GUESS = "pending_guess"
    COMPLETED = "completed"
    EXPIRED = "expired"


class CreateBridgingGameRequest(BaseModel):
    """Request to create a bridging game."""
    anchor_word: str = Field(
        min_length=1,
        max_length=50,
        description="The starting concept of the bridge"
    )
    target_word: str = Field(
        min_length=1,
        max_length=50,
        description="The ending concept of the bridge"
    )
    recipient_type: BridgingRecipientType = BridgingRecipientType.HAIKU


class CreateBridgingGameResponse(BaseModel):
    """Response after creating a bridging game."""
    game_id: str
    anchor_word: str
    target_word: str
    status: BridgingGameStatus


class SubmitBridgingCluesRequest(BaseModel):
    """Request to submit clues for a bridging game."""
    clues: list[str] = Field(
        min_length=1,
        max_length=5,
        description="1-5 clue words connecting anchor and target"
    )


class SubmitBridgingCluesResponse(BaseModel):
    """Response after submitting bridging clues."""
    game_id: str
    clues: list[str]

    # New unified scoring (V3) - Relevance + Spread (DAT-style)
    relevance: Optional[float] = None           # 0-1: mean similarity to anchor+target
    relevance_percentile: Optional[float] = None  # 0-100: percentile vs random baseline
    divergence: Optional[float] = None          # 0-100: DAT-style spread score

    # Legacy scoring fields (V2) - kept for backwards compatibility
    divergence_score: float                     # Old divergence (angular, 0-100)
    binding_score: float                        # Old binding (min-based, 0-100)

    # Lexical union (statistical baseline)
    lexical_bridge: Optional[list[str]] = None
    lexical_relevance: Optional[float] = None   # New: relevance of lexical union
    lexical_divergence: Optional[float] = None  # New: spread of lexical union
    lexical_similarity: Optional[float] = None  # Legacy: similarity to user's union

    status: BridgingGameStatus
    share_code: Optional[str] = None

    # V2/V3: If Haiku recipient, includes Haiku's union
    haiku_clues: Optional[list[str]] = None
    haiku_relevance: Optional[float] = None     # New: relevance of Haiku's union
    haiku_divergence: Optional[float] = None    # Spread of Haiku's union
    haiku_binding: Optional[float] = None       # Legacy: old binding score
    haiku_bridge_similarity: Optional[float] = None  # Legacy: similarity to user's union

    # Legacy fields (for backwards compat with old games)
    haiku_guessed_anchor: Optional[str] = None
    haiku_guessed_target: Optional[str] = None
    haiku_reconstruction_score: Optional[float] = None


class SuggestWordRequest(BaseModel):
    """Request to suggest a distant word."""
    from_word: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Word to find distant suggestions from. If empty, returns random word."
    )


class SuggestWordResponse(BaseModel):
    """Response with suggested distant word."""
    suggestion: str
    from_word: Optional[str] = None


class CreateBridgingShareResponse(BaseModel):
    """Response with share code for bridging game."""
    share_code: str
    share_url: str


class JoinBridgingGameResponse(BaseModel):
    """Response after joining a bridging game via share code."""
    game_id: str
    clues: list[str]
    # anchor_word and target_word NOT included - that's what recipient guesses


class SubmitBridgingGuessRequest(BaseModel):
    """Request to submit reconstruction guesses."""
    guessed_anchor: str = Field(
        min_length=1,
        max_length=50,
        description="Guess for the anchor word"
    )
    guessed_target: str = Field(
        min_length=1,
        max_length=50,
        description="Guess for the target word"
    )


class SubmitBridgingGuessResponse(BaseModel):
    """Response after submitting reconstruction guesses."""
    game_id: str
    guessed_anchor: str
    guessed_target: str
    reconstruction_score: float
    anchor_similarity: float
    target_similarity: float
    order_swapped: bool
    exact_anchor_match: bool
    exact_target_match: bool
    # Revealed after guessing
    true_anchor: str
    true_target: str
    status: BridgingGameStatus


class BridgingGameResponse(BaseModel):
    """Full bridging game state."""
    game_id: str
    sender_id: str
    recipient_id: Optional[str]
    recipient_type: BridgingRecipientType
    anchor_word: str
    target_word: str
    clues: Optional[list[str]]
    divergence_score: Optional[float]
    binding_score: Optional[float] = None  # How well clues jointly relate to both endpoints
    lexical_bridge: Optional[list[str]] = None  # Equidistant concept set
    lexical_similarity: Optional[float] = None  # Similarity between user clues and lexical union
    # Legacy V1: Recipient guesses
    guessed_anchor: Optional[str]
    guessed_target: Optional[str]
    reconstruction_score: Optional[float]
    anchor_similarity: Optional[float]
    target_similarity: Optional[float]
    order_swapped: Optional[bool]
    exact_anchor_match: Optional[bool]
    exact_target_match: Optional[bool]
    # V2: Recipient's union
    recipient_clues: Optional[list[str]] = None
    recipient_divergence: Optional[float] = None
    recipient_binding: Optional[float] = None
    bridge_similarity: Optional[float] = None
    # Legacy V1: Haiku guesses
    haiku_guessed_anchor: Optional[str]
    haiku_guessed_target: Optional[str]
    haiku_reconstruction_score: Optional[float]
    # V2: Haiku's union
    haiku_clues: Optional[list[str]] = None
    haiku_divergence: Optional[float] = None
    haiku_binding: Optional[float] = None
    haiku_bridge_similarity: Optional[float] = None
    # Statistical baseline
    statistical_guessed_anchor: Optional[str]
    statistical_guessed_target: Optional[str]
    statistical_baseline_score: Optional[float]
    # State
    status: BridgingGameStatus
    share_code: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]


class TriggerHaikuGuessResponse(BaseModel):
    """Response after triggering Haiku reconstruction (legacy)."""
    game_id: str
    haiku_guessed_anchor: str
    haiku_guessed_target: str
    haiku_reconstruction_score: float


# ============================================
# INS-001.2 v2: BRIDGE-VS-BRIDGE
# ============================================

class SemanticDistanceResponse(BaseModel):
    """Response with semantic distance between two words."""
    anchor: str
    target: str
    distance: float  # 0-100 scale
    interpretation: str  # "close", "moderate", "distant", "very distant"


class JoinBridgingGameResponseV2(BaseModel):
    """Response after joining a bridging game (v2: shows anchor + target)."""
    game_id: str
    anchor_word: str  # Recipient sees this
    target_word: str  # Recipient sees this
    sender_clue_count: int  # How many clues sender used


class SubmitBridgingBridgeRequest(BaseModel):
    """Request to submit recipient's bridge (their clues)."""
    clues: list[str] = Field(
        min_length=1,
        max_length=5,
        description="1-5 clue words forming recipient's bridge"
    )


class SubmitBridgingBridgeResponse(BaseModel):
    """Response after submitting recipient's bridge."""
    game_id: str
    # Recipient's bridge
    recipient_clues: list[str]
    recipient_divergence: float
    # Sender's bridge (revealed after submission)
    sender_clues: list[str]
    sender_divergence: float
    # Bridge comparison
    bridge_similarity: float  # 0-100
    path_alignment: Optional[float]  # -1 to 1
    # Meta
    anchor_word: str
    target_word: str
    status: BridgingGameStatus


class TriggerHaikuBridgeResponse(BaseModel):
    """Response after triggering Haiku to build its own bridge."""
    game_id: str
    haiku_clues: list[str]
    haiku_divergence: float
    haiku_bridge_similarity: float  # Compared to sender's bridge


class BridgingGameResponseV2(BaseModel):
    """Full bridging game state (v2: bridge-vs-bridge)."""
    game_id: str
    sender_id: str
    recipient_id: Optional[str]
    recipient_type: BridgingRecipientType
    anchor_word: str
    target_word: str
    # Sender's bridge
    clues: Optional[list[str]]
    divergence_score: Optional[float]
    binding_score: Optional[float] = None
    # Recipient's bridge (v2)
    recipient_clues: Optional[list[str]]
    recipient_divergence: Optional[float]
    recipient_binding: Optional[float] = None
    bridge_similarity: Optional[float]
    path_alignment: Optional[float]
    # Haiku's bridge (v2)
    haiku_clues: Optional[list[str]]
    haiku_divergence: Optional[float]
    haiku_binding: Optional[float] = None
    haiku_bridge_similarity: Optional[float]
    # Legacy fields (for old games)
    guessed_anchor: Optional[str]
    guessed_target: Optional[str]
    reconstruction_score: Optional[float]
    haiku_guessed_anchor: Optional[str]
    haiku_guessed_target: Optional[str]
    haiku_reconstruction_score: Optional[float]
    # State
    status: BridgingGameStatus
    share_code: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
