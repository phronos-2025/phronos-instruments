"""
Embedding Service - INS-001 Semantic Associations

Handles all embedding operations:
- Contextual embeddings via OpenAI
- Noise floor generation via pgvector (with LLM fallback for sparse domains)
- Word validation

Hybrid Strategy (Option C):
- Primary: pgvector similarity search against curated vocabulary (~30K words)
- Fallback: LLM-generated semantic neighbors for domain-specific seeds
  when vocabulary coverage is insufficient
"""

import os
from typing import Optional
import numpy as np
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from supabase import Client

# ============================================
# CONFIGURATION
# ============================================

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")  # Optional, for fallback
EMBEDDING_MODEL = "text-embedding-3-small"  # 1536 dimensions, $0.02/1M tokens

# Noise floor quality thresholds
# If best vocabulary match is below this, trigger LLM fallback
MIN_SIMILARITY_THRESHOLD = 0.45
# Minimum number of good matches needed from vocabulary
MIN_GOOD_MATCHES = 10

# Initialize clients
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None

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

async def _get_llm_semantic_neighbors(seed_word: str, k: int = 20) -> list[str]:
    """
    Use LLM to generate semantic neighbors for domain-specific seeds.

    This is a fallback for when the vocabulary doesn't have good coverage
    for specialized terms (medical, legal, technical, etc.).

    Args:
        seed_word: The seed word to find neighbors for
        k: Number of neighbors to generate

    Returns:
        List of semantically related words
    """
    if not anthropic_client:
        return []

    prompt = f"""Generate {k} words that are semantically related to "{seed_word}".

Rules:
- Return ONLY single words, one per line
- Words should be semantically related (same category, associated concepts, etc.)
- Do NOT include the seed word itself
- Do NOT include morphological variants (plurals, verb forms) of the seed
- Focus on words a typical English speaker would associate with this concept
- Include a mix of: synonyms, category members, related concepts, typical associations

Example for "cardiologist":
doctor
heart
physician
surgeon
medicine
hospital
specialist
healthcare
cardiology
patient

Now generate {k} words for "{seed_word}":"""

    try:
        response = await anthropic_client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )

        # Parse response - one word per line
        text = response.content[0].text
        words = [w.strip().lower() for w in text.strip().split('\n') if w.strip()]

        # Filter to valid single words
        words = [w for w in words if w.isalpha() and len(w) >= 3 and w != seed_word.lower()]

        return words[:k]

    except Exception as e:
        print(f"LLM fallback failed for '{seed_word}': {e}")
        return []


def _is_semantically_meaningful(seed_word: str, candidate: str, similarity: float) -> bool:
    """
    Filter out phonetically/orthographically similar words that aren't semantically meaningful.

    Text embeddings capture BOTH semantic AND lexical similarity. This causes problems:
    - "riptide" → "ribbon", "rifle", "trident" (share letters, not meaning)
    - "monkey" → "donkey" (rhyme)
    - "orange" → "indo", "omega" (share letters)

    Key insight: TRUE semantic neighbors have HIGH similarity + HIGH edit distance.
    Phonetic/lexical matches have MODERATE similarity + LOW edit distance.
    """
    seed_lower = seed_word.lower()
    cand_lower = candidate.lower()

    # Filter out possessives and simple variations of the seed word
    if cand_lower == seed_lower + "'s" or cand_lower == seed_lower + "s":
        return False
    if seed_lower == cand_lower + "'s" or seed_lower == cand_lower + "s":
        return False

    # Filter plurals: if candidate is seed + "s" or seed is candidate + "s"
    if cand_lower.rstrip('s') == seed_lower.rstrip('s') and cand_lower != seed_lower:
        return False

    # Filter very short words (4 chars or less) - often noise
    if len(cand_lower) <= 4:
        return False

    # Filter words that are substrings of the seed or vice versa
    if len(cand_lower) >= 3 and len(seed_lower) >= 3:
        if cand_lower in seed_lower or seed_lower in cand_lower:
            return False

    # Calculate edit distance ratio (0 = identical, 1 = completely different)
    def levenshtein_ratio(s1: str, s2: str) -> float:
        if s1 == s2:
            return 0.0
        len1, len2 = len(s1), len(s2)
        if len1 == 0 or len2 == 0:
            return 1.0

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

    # Calculate character overlap ratio (Jaccard on character sets)
    seed_chars = set(seed_lower)
    cand_chars = set(cand_lower)
    overlap = len(seed_chars & cand_chars) / len(seed_chars | cand_chars)

    # Check for shared prefix
    shared_prefix_len = 0
    for i in range(min(len(seed_lower), len(cand_lower))):
        if seed_lower[i] == cand_lower[i]:
            shared_prefix_len += 1
        else:
            break

    # Check for shared suffix
    shared_suffix_len = 0
    for i in range(1, min(len(seed_lower), len(cand_lower)) + 1):
        if seed_lower[-i] == cand_lower[-i]:
            shared_suffix_len += 1
        else:
            break

    # CORE FILTER: Reject words that are orthographically similar but not semantically related
    # The goal is to filter phonetic/spelling matches like "riptide" → "ribbon"
    # while keeping true semantic neighbors like "coffee" → "espresso"

    # Reject low similarity entirely
    if similarity < 0.45:
        return False

    # For high similarity (>0.60), trust the embedding - these are strong semantic matches
    # Only filter if BOTH very similar spelling AND high character overlap (true duplicates)
    if similarity >= 0.60:
        if edit_ratio < 0.3 and overlap > 0.6:
            return False
        return True

    # Moderate similarity (0.45-0.60): Filter obvious phonetic matches
    # Be more permissive - only reject when multiple red flags combine

    red_flags = 0

    # Very low edit distance (nearly same spelling)
    if edit_ratio < 0.4:
        red_flags += 2
    elif edit_ratio < 0.5:
        red_flags += 1

    # High character overlap
    if overlap > 0.6:
        red_flags += 1

    # Long shared prefix (4+ chars suggests morphological relation)
    if shared_prefix_len >= 4:
        red_flags += 1

    # Long shared suffix (3+ chars)
    if shared_suffix_len >= 3:
        red_flags += 1

    # Only reject if multiple red flags (likely phonetic noise)
    return red_flags < 3


async def get_noise_floor(
    supabase: Client,
    seed_word: str,
    sense_context: Optional[list[str]] = None,
    k: int = 20
) -> list[dict]:
    """
    Get noise floor for ANY seed word (not just vocabulary).

    Hybrid Strategy (Option C):
    1. Primary: pgvector similarity search against curated vocabulary
    2. Fallback: If vocabulary coverage is sparse, use LLM to generate
       semantic neighbors, then embed and score them

    Works for:
    - Standard vocabulary words (fast, vocabulary-only)
    - Domain-specific terms (medical, legal, etc.) - triggers LLM fallback
    - Proper nouns (Shakespeare, Obi-Wan) - triggers LLM fallback
    - Slang and neologisms - triggers LLM fallback

    Args:
        supabase: Authenticated Supabase client
        seed_word: Any word/phrase (not restricted to vocabulary)
        sense_context: Context words for polysemous seeds
        k: Number of nearest neighbors to return

    Returns:
        List of {word, similarity} dicts

    Cost:
    - Vocabulary hit: ~$0.00002 (OpenAI embedding only)
    - LLM fallback: ~$0.001 (Haiku + embeddings)
    Latency:
    - Cache hit: <10ms
    - Vocabulary hit: ~300ms
    - LLM fallback: ~800ms
    """
    from app.services.cache import NoiseFloorCache

    seed_word_clean = seed_word.lower().strip()

    # Check noise floor cache first
    nf_cache = NoiseFloorCache.get_instance()
    cached_result = nf_cache.get(seed_word_clean, sense_context, k)
    if cached_result is not None:
        return cached_result

    # Always embed seed on-demand (handles any word)
    if sense_context:
        seed_emb = await get_contextual_embedding(seed_word_clean, sense_context)
    else:
        seed_emb = await get_embedding(seed_word_clean)

    # Find nearest neighbors in vocabulary
    # Fetch more than k to allow for filtering phonetic/orthographic matches
    fetch_k = k * 2

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
    vocab_results = [
        item for item in raw_results
        if _is_semantically_meaningful(seed_word_clean, item["word"], item["similarity"])
    ]

    # Check if vocabulary coverage is sufficient
    best_similarity = vocab_results[0]["similarity"] if vocab_results else 0
    good_matches = sum(1 for r in vocab_results if r["similarity"] >= MIN_SIMILARITY_THRESHOLD)

    # Only trigger expensive LLM fallback if coverage is truly sparse
    # (less than half of requested results with good similarity)
    min_required = max(k // 2, 3)
    needs_fallback = (
        best_similarity < MIN_SIMILARITY_THRESHOLD or
        good_matches < min_required
    )

    # Use LLM fallback for sparse coverage (domain-specific seeds)
    if needs_fallback and anthropic_client:
        llm_neighbors = await _get_llm_semantic_neighbors(seed_word_clean, k=k)

        if llm_neighbors:
            # Embed LLM-generated neighbors and compute similarities
            neighbor_embeddings = await get_embeddings_batch(llm_neighbors)

            llm_results = []
            for word, emb in zip(llm_neighbors, neighbor_embeddings):
                # Compute cosine similarity
                sim = float(np.dot(seed_emb, emb) / (np.linalg.norm(seed_emb) * np.linalg.norm(emb)))
                llm_results.append({"word": word, "similarity": sim, "source": "llm"})

            # Merge with vocabulary results, preferring higher similarity
            # Create word -> result map
            merged = {r["word"]: r for r in vocab_results}
            for r in llm_results:
                if r["word"] not in merged or r["similarity"] > merged[r["word"]]["similarity"]:
                    merged[r["word"]] = r

            # Sort by similarity and return top k
            final_results = sorted(merged.values(), key=lambda x: x["similarity"], reverse=True)
            result = final_results[:k]
            nf_cache.put(seed_word_clean, result, sense_context, k)
            return result

    # Return vocabulary results (sufficient coverage)
    result = vocab_results[:k]
    nf_cache.put(seed_word_clean, result, sense_context, k)
    return result


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
