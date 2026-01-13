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

def _is_semantically_meaningful(seed_word: str, candidate: str, similarity: float) -> bool:
    """
    Filter out phonetically/orthographically similar words that aren't semantically meaningful.

    Text embeddings capture both semantic AND lexical similarity. This causes issues like:
    - "monkey" returning "donkey" (rhyme), "mani" (similar sounds), "wan" (short)

    We filter based on:
    1. Edit distance relative to word length (catch near-anagrams)
    2. Common suffix patterns (possessives, plurals of the seed)
    3. Very short words that match by chance
    """
    seed_lower = seed_word.lower()
    cand_lower = candidate.lower()

    # Filter out possessives and simple variations of the seed word
    if cand_lower == seed_lower + "'s" or cand_lower == seed_lower + "s":
        return False
    if seed_lower == cand_lower + "'s" or seed_lower == cand_lower + "s":
        return False

    # Filter very short words (3 chars or less) - often noise unless reasonably similar
    if len(cand_lower) <= 3 and similarity < 0.65:
        return False

    # Filter 4-letter words that share 3+ characters with the seed (likely phonetic noise)
    if len(cand_lower) == 4 and similarity < 0.7:
        shared_chars = sum(1 for c in cand_lower if c in seed_lower)
        if shared_chars >= 3:
            return False

    # Filter words that are substrings of the seed or vice versa (likely partial matches)
    if len(cand_lower) >= 3 and len(seed_lower) >= 3:
        if cand_lower in seed_lower or seed_lower in cand_lower:
            if similarity < 0.85:
                return False

    # Calculate simple edit distance ratio
    # Words that are very similar in spelling but not the same word are likely phonetic matches
    def levenshtein_ratio(s1: str, s2: str) -> float:
        """Returns ratio of edit distance to max length (0 = identical, 1 = completely different)"""
        if s1 == s2:
            return 0.0
        len1, len2 = len(s1), len(s2)
        if len1 == 0 or len2 == 0:
            return 1.0

        # Simple Levenshtein distance
        dp = [[0] * (len2 + 1) for _ in range(len1 + 1)]
        for i in range(len1 + 1):
            dp[i][0] = i
        for j in range(len2 + 1):
            dp[0][j] = j
        for i in range(1, len1 + 1):
            for j in range(1, len2 + 1):
                cost = 0 if s1[i-1] == s2[j-1] else 1
                dp[i][j] = min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost)

        return dp[len1][len2] / max(len1, len2)

    edit_ratio = levenshtein_ratio(seed_lower, cand_lower)

    # If words are very similar in spelling (edit ratio < 0.4) but similarity is moderate,
    # it's likely a phonetic match, not semantic
    # Truly semantic matches (like "monkey" -> "animal") have high similarity AND high edit distance
    if edit_ratio < 0.4 and similarity < 0.85:
        return False

    # Filter words that share too many characters (likely phonetic)
    # e.g., "monkey" and "donkey" share "onkey"
    if len(seed_lower) >= 4 and len(cand_lower) >= 4:
        # Check for shared suffix of 4+ chars
        min_len = min(len(seed_lower), len(cand_lower))
        for suffix_len in range(4, min_len):
            if seed_lower[-suffix_len:] == cand_lower[-suffix_len:]:
                # Shared suffix - likely rhyme, not semantic unless very high similarity
                if similarity < 0.8:
                    return False
                break

    return True


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
    # Fetch more than k to allow for filtering phonetic/orthographic matches
    # The noise floor is always vocabulary words, even if seed isn't
    fetch_k = k * 3  # Fetch 3x to have enough after filtering

    result = supabase.rpc(
        "get_noise_floor_by_embedding",
        {
            "seed_embedding": seed_emb,
            "seed_word": seed_word_clean,
            "k": fetch_k
        }
    ).execute()

    raw_results = result.data or []

    # Filter for semantically meaningful associations
    filtered = [
        item for item in raw_results
        if _is_semantically_meaningful(seed_word_clean, item["word"], item["similarity"])
    ]

    # Return top k after filtering
    return filtered[:k]


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
