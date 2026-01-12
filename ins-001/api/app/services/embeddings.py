"""
Embedding Service - INS-001 Semantic Associations

Handles all embedding operations:
- Contextual embeddings via OpenAI
- Noise floor generation via pgvector
- Word validation
"""

import os
from typing import Optional
from openai import AsyncOpenAI
from supabase import Client

# ============================================
# CONFIGURATION
# ============================================

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
EMBEDDING_MODEL = "text-embedding-3-small"  # 1536 dimensions, $0.02/1M tokens

# Initialize OpenAI client
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# Known polysemous words with their senses
# Expand this list based on user feedback
POLYSEMOUS_WORDS = {
    "bat": ["flying mammal", "sports equipment"],
    "bank": ["financial institution", "river edge"],
    "spring": ["season", "coiled metal", "water source"],
    "rock": ["stone", "music genre", "to sway"],
    "light": ["illumination", "not heavy"],
    "bark": ["tree covering", "dog sound"],
    "bass": ["fish", "low frequency", "musical instrument"],
    "bow": ["weapon", "front of ship", "decorative knot", "to bend"],
    "lead": ["metal", "to guide", "leash"],
    "tear": ["eye fluid", "to rip"],
    "wind": ["moving air", "to turn"],
    "present": ["gift", "current time", "to show"],
    "close": ["near", "to shut"],
    "live": ["to exist", "in real-time"],
    "read": ["to interpret text", "past tense of read"],
    "minute": ["60 seconds", "very small"],
    "object": ["thing", "to oppose"],
    "project": ["task", "to throw forward"],
    "record": ["documentation", "to capture"],
    "refuse": ["to decline", "garbage"],
}


# ============================================
# EMBEDDING FUNCTIONS
# ============================================

async def get_embedding(text: str) -> list[float]:
    """
    Get embedding for a single text string.
    
    Uses OpenAI text-embedding-3-small (1536 dimensions).
    """
    response = await openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text
    )
    return response.data[0].embedding


async def get_contextual_embedding(
    word: str, 
    context: list[str]
) -> list[float]:
    """
    Get embedding for a word with semantic context.
    
    Context helps disambiguate polysemous words:
    - embed("bank", ["river", "water"]) → riverbank meaning
    - embed("bank", ["money", "account"]) → financial meaning
    
    Args:
        word: The word to embed
        context: List of context words to disambiguate meaning
        
    Returns:
        1536-dimensional embedding vector
    """
    if context:
        text = f"{word} (in context: {', '.join(context)})"
    else:
        text = word
    
    return await get_embedding(text)


async def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """
    Get embeddings for multiple texts in a single API call.
    More efficient than calling get_embedding() in a loop.
    """
    response = await openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts
    )
    return [item.embedding for item in response.data]


# ============================================
# NOISE FLOOR
# ============================================

async def get_noise_floor(
    supabase: Client,
    seed_word: str,
    sense_context: Optional[list[str]] = None,
    k: int = 20
) -> list[dict]:
    """
    Get noise floor for ANY seed word (not just vocabulary).
    
    This embeds the seed word on-demand via OpenAI, then finds
    the k nearest neighbors in the vocabulary table.
    
    Works for:
    - Standard vocabulary words
    - Domain-specific terms (medical, legal, etc.)
    - Proper nouns (Shakespeare, Obi-Wan)
    - Slang and neologisms
    - Misspellings (will return nearest "real" words)
    
    Args:
        supabase: Authenticated Supabase client
        seed_word: Any word/phrase (not restricted to vocabulary)
        sense_context: Context words for polysemous seeds
        k: Number of nearest neighbors to return
        
    Returns:
        List of {word, similarity} dicts from vocabulary
        
    Cost: ~$0.00002 per call (negligible)
    Latency: ~300ms (OpenAI API call)
    """
    seed_word_clean = seed_word.lower().strip()
    
    # Always embed on-demand (handles any word)
    if sense_context:
        seed_emb = await get_contextual_embedding(seed_word_clean, sense_context)
    else:
        seed_emb = await get_embedding(seed_word_clean)
    
    # Find nearest neighbors in vocabulary
    # The noise floor is always vocabulary words, even if seed isn't
    result = supabase.rpc(
        "get_noise_floor_by_embedding",
        {
            "seed_embedding": seed_emb,
            "seed_word": seed_word_clean,
            "k": k
        }
    ).execute()
    
    return result.data or []


async def check_word_in_vocabulary(supabase: Client, word: str) -> bool:
    """
    Check if a word exists in vocabulary (for analytics tracking).
    
    Note: This is NOT for blocking - just for tracking whether
    the user chose a vocabulary word or a custom word.
    
    Returns:
        True if word exists in vocabulary_embeddings table
    """
    return await validate_word(supabase, word)


def get_sense_options(word: str) -> Optional[list[str]]:
    """
    Check if a word is polysemous and return its sense options.
    
    Returns:
        List of sense descriptions if polysemous, None otherwise
    """
    return POLYSEMOUS_WORDS.get(word.lower().strip())


def is_polysemous(word: str) -> bool:
    """Check if a word is in the known polysemous list."""
    return word.lower().strip() in POLYSEMOUS_WORDS


# ============================================
# VALIDATION
# ============================================

async def validate_word(supabase: Client, word: str) -> bool:
    """
    Check if a word exists in the vocabulary.
    
    USE FOR: Clues and guesses (NOT seed words)
    
    Why validate clues/guesses but not seeds?
    - Clues go to LLM prompt → need validation for prompt safety
    - Guesses need scoring → need reliable embeddings
    - Seed is hidden answer → never enters LLM, no injection risk
    
    For seed words, use is_blocked_word() from config instead.
    
    Args:
        supabase: Authenticated Supabase client
        word: Word to validate
        
    Returns:
        True if word exists in vocabulary_embeddings table
    """
    word = word.lower().strip()
    
    result = supabase.table("vocabulary_embeddings") \
        .select("word") \
        .eq("word", word) \
        .limit(1) \
        .execute()
    
    return len(result.data) > 0


async def validate_words(supabase: Client, words: list[str]) -> tuple[bool, list[str]]:
    """
    Validate multiple words against vocabulary.
    
    USE FOR: Clues and guesses (NOT seed words)
    
    Returns:
        Tuple of (all_valid, list_of_invalid_words)
    """
    invalid = []
    for word in words:
        if not await validate_word(supabase, word):
            invalid.append(word)
    
    return len(invalid) == 0, invalid


# ============================================
# SQL FUNCTION FOR CONTEXTUAL FLOOR
# Add this to migrations if using polysemy feature
# ============================================

CONTEXTUAL_FLOOR_SQL = """
-- Get noise floor using a provided embedding vector
-- Used for polysemous words where we compute embedding with context
-- NOTE: Use vector(1536) if halfvec is not available
CREATE OR REPLACE FUNCTION get_noise_floor_by_embedding(
    seed_embedding vector(1536),  -- Changed from halfvec(1536) if halfvec unavailable
    seed_word TEXT,
    k INT DEFAULT 20
)
RETURNS TABLE(word TEXT, similarity FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.word,
        (1 - (v.embedding <=> seed_embedding))::FLOAT as similarity
    FROM vocabulary_embeddings v
    WHERE v.word != seed_word
    ORDER BY v.embedding <=> seed_embedding
    LIMIT k;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
"""
