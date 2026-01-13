"""
Vocabulary Embedding Script - INS-001 Semantic Associations

Builds a curated vocabulary from multiple sources:
1. WordNet lemmas (nouns, verbs, adjectives, adverbs) - semantic richness
2. wordfreq top words - frequency ranking for common usage
3. Filtered to remove symbols, numbers, and words < 3 characters

Usage:
    python scripts/embed_vocabulary.py [--clean] [--dry-run]

Options:
    --clean    Delete all existing vocabulary before inserting
    --dry-run  Show what would be inserted without actually inserting

Requirements:
    - nltk: pip install nltk
    - wordfreq: pip install wordfreq
    - OPENAI_API_KEY environment variable
    - SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables
"""

import os
import sys
import asyncio
import re
import time
from pathlib import Path
from typing import Set, Dict, List, Tuple
from dotenv import load_dotenv

# Load environment variables from custom location if specified
env_file = os.environ.get("ENV_FILE", None)
if env_file:
    load_dotenv(env_file)
else:
    script_dir = Path(__file__).parent.parent
    default_env = script_dir / ".env"
    if default_env.exists():
        load_dotenv(default_env)
    else:
        custom_env = Path("/Users/vishal/Documents/Secrets/instruments-keys.env")
        if custom_env.exists():
            load_dotenv(custom_env)

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from openai import AsyncOpenAI
from supabase import create_client, Client

# Get env vars directly
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
EMBEDDING_MODEL = "text-embedding-3-small"

# Configuration
BATCH_SIZE = 2000  # OpenAI limit is 2048 per call
CHUNK_SIZE = 50    # DB insert chunk size to avoid timeout
MIN_WORD_LENGTH = 3
MAX_WORD_LENGTH = 25
TARGET_VOCABULARY_SIZE = 30000  # Curated size (smaller but higher quality)

# Initialize clients (will be set in main)
openai_client = None
supabase = None


# ============================================
# WORD FILTERING
# ============================================

def is_valid_word(word: str) -> bool:
    """
    Filter out junk words that don't add semantic value.

    Removes:
    - Symbols and punctuation (©, ®, —, etc.)
    - Numbers and words with numbers
    - Words shorter than 3 characters
    - Words longer than 25 characters
    - Words with special characters
    - Abbreviations that are all caps (except common ones)
    """
    if not word:
        return False

    word = word.strip()

    # Length check
    if len(word) < MIN_WORD_LENGTH or len(word) > MAX_WORD_LENGTH:
        return False

    # Must be alphabetic (allows hyphens and apostrophes for compound words)
    if not re.match(r"^[a-zA-Z]+(?:[-'][a-zA-Z]+)*$", word):
        return False

    # Filter out all-caps abbreviations (keep common ones)
    common_acronyms = {'usa', 'uk', 'tv', 'dna', 'fbi', 'cia', 'nasa', 'aids'}
    if word.isupper() and word.lower() not in common_acronyms:
        return False

    return True


def normalize_word(word: str) -> str:
    """Normalize a word for consistent storage."""
    return word.lower().strip()


# ============================================
# VOCABULARY SOURCES
# ============================================

def load_wordnet_lemmas() -> Set[str]:
    """
    Load all lemmas from WordNet (nouns, verbs, adjectives, adverbs).

    WordNet provides semantically meaningful words organized by meaning.
    ~118,000 unique lemmas total.
    """
    try:
        import nltk
        from nltk.corpus import wordnet as wn

        # Download WordNet data if not present
        try:
            wn.synsets('test')
        except LookupError:
            print("  Downloading WordNet data...")
            nltk.download('wordnet', quiet=True)
            nltk.download('omw-1.4', quiet=True)

        lemmas = set()
        pos_counts = {'n': 0, 'v': 0, 'a': 0, 'r': 0}

        for synset in wn.all_synsets():
            pos = synset.pos()
            for lemma in synset.lemmas():
                # WordNet uses underscores for multi-word terms
                word = lemma.name().replace('_', '-')
                if is_valid_word(word):
                    lemmas.add(normalize_word(word))
                    pos_counts[pos] = pos_counts.get(pos, 0) + 1

        print(f"  WordNet: {len(lemmas)} valid lemmas")
        print(f"    Nouns: ~{pos_counts['n']}, Verbs: ~{pos_counts['v']}, "
              f"Adj: ~{pos_counts['a']}, Adv: ~{pos_counts['r']}")

        return lemmas

    except ImportError:
        print("  WARNING: nltk not installed, skipping WordNet")
        print("  Install with: pip install nltk")
        return set()


def load_wordfreq_words(top_n: int = 50000) -> List[Tuple[str, int]]:
    """
    Load top N words from wordfreq with their frequency ranks.

    wordfreq provides frequency-ranked words from real usage data.
    Returns list of (word, rank) tuples for words that pass filtering.
    """
    try:
        from wordfreq import top_n_list

        raw_words = top_n_list('en', top_n)
        ranked_words = []

        for rank, word in enumerate(raw_words, 1):
            if is_valid_word(word):
                ranked_words.append((normalize_word(word), rank))

        print(f"  wordfreq: {len(ranked_words)} valid words (from top {top_n})")

        return ranked_words

    except ImportError:
        print("  WARNING: wordfreq not installed, skipping")
        print("  Install with: pip install wordfreq")
        return []


def build_curated_vocabulary() -> List[Dict]:
    """
    Build curated vocabulary combining multiple sources.

    Strategy:
    1. Start with WordNet lemmas (semantic coverage)
    2. Add wordfreq words (frequency data)
    3. Merge and deduplicate
    4. Assign frequency ranks (wordfreq rank if available, else high number)

    Returns list of {word, frequency_rank} dicts sorted by rank.
    """
    print("\n=== Building Curated Vocabulary ===\n")

    # Load sources
    print("Loading WordNet lemmas...")
    wordnet_lemmas = load_wordnet_lemmas()

    print("\nLoading wordfreq words...")
    wordfreq_ranked = load_wordfreq_words(top_n=50000)

    # Build frequency map from wordfreq
    freq_map = {word: rank for word, rank in wordfreq_ranked}

    # Combine all words
    all_words = set(wordnet_lemmas)
    all_words.update(word for word, _ in wordfreq_ranked)

    print(f"\nTotal unique words after merge: {len(all_words)}")

    # Create vocabulary entries with frequency ranks
    vocabulary = []
    wordfreq_count = 0
    wordnet_only_count = 0

    for word in all_words:
        if word in freq_map:
            rank = freq_map[word]
            wordfreq_count += 1
        else:
            # WordNet-only words get a high rank (less frequent)
            rank = 100000 + len(vocabulary)
            wordnet_only_count += 1

        vocabulary.append({
            "word": word,
            "frequency_rank": rank
        })

    # Sort by frequency rank (most common first)
    vocabulary.sort(key=lambda x: x["frequency_rank"])

    # Trim to target size if needed
    if len(vocabulary) > TARGET_VOCABULARY_SIZE:
        print(f"\nTrimming to {TARGET_VOCABULARY_SIZE} most useful words...")
        vocabulary = vocabulary[:TARGET_VOCABULARY_SIZE]

    print(f"\n=== Vocabulary Summary ===")
    print(f"  Total words: {len(vocabulary)}")
    print(f"  From wordfreq (with rank): {min(wordfreq_count, len(vocabulary))}")
    print(f"  From WordNet only: {wordnet_only_count}")
    print(f"  Size: ~{len(vocabulary) * 3}KB (estimated DB storage)")

    return vocabulary


# ============================================
# EMBEDDING & DATABASE
# ============================================

async def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Get embeddings for a batch of texts."""
    response = await openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts
    )
    return [item.embedding for item in response.data]


async def clean_vocabulary_table():
    """Delete all existing vocabulary entries."""
    print("\nCleaning vocabulary table...")
    try:
        # Delete in batches to avoid timeout
        while True:
            result = supabase.table("vocabulary_embeddings") \
                .select("word") \
                .limit(1000) \
                .execute()

            if not result.data:
                break

            words = [r["word"] for r in result.data]
            supabase.table("vocabulary_embeddings") \
                .delete() \
                .in_("word", words) \
                .execute()

            print(f"  Deleted {len(words)} words...")

        print("  ✓ Table cleaned")
    except Exception as e:
        print(f"  ✗ Error cleaning table: {e}")
        raise


async def embed_and_insert_vocabulary(vocabulary: List[Dict], dry_run: bool = False):
    """Embed vocabulary words and insert into database."""

    if dry_run:
        print("\n=== DRY RUN - No changes will be made ===")
        print(f"\nWould insert {len(vocabulary)} words:")
        print(f"  First 10: {[v['word'] for v in vocabulary[:10]]}")
        print(f"  Last 10: {[v['word'] for v in vocabulary[-10:]]}")
        return

    total_words = len(vocabulary)
    total_batches = (total_words + BATCH_SIZE - 1) // BATCH_SIZE

    print(f"\n=== Embedding {total_words} words ===")
    print(f"  Batches: {total_batches}")
    print(f"  Estimated cost: ~${total_words * 0.00001:.2f}")

    inserted_count = 0

    for i in range(0, total_words, BATCH_SIZE):
        batch = vocabulary[i:i+BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1

        print(f"\nBatch {batch_num}/{total_batches} ({len(batch)} words)...")

        try:
            # Get embeddings
            words = [v["word"] for v in batch]
            print("  Fetching embeddings from OpenAI...")
            embeddings = await get_embeddings_batch(words)

            # Prepare records
            records = []
            for vocab_entry, embedding in zip(batch, embeddings):
                records.append({
                    "word": vocab_entry["word"],
                    "embedding": embedding,
                    "frequency_rank": vocab_entry["frequency_rank"]
                })

            # Insert in chunks
            print(f"  Inserting {len(records)} records...")
            for chunk_start in range(0, len(records), CHUNK_SIZE):
                chunk = records[chunk_start:chunk_start + CHUNK_SIZE]
                chunk_num = chunk_start // CHUNK_SIZE + 1
                total_chunks = (len(records) + CHUNK_SIZE - 1) // CHUNK_SIZE

                try:
                    supabase.table("vocabulary_embeddings").upsert(
                        chunk,
                        on_conflict="word"
                    ).execute()
                    inserted_count += len(chunk)

                    if chunk_num % 10 == 0:
                        print(f"    Chunk {chunk_num}/{total_chunks}")

                except Exception as chunk_error:
                    print(f"    ⚠ Chunk {chunk_num} failed: {chunk_error}")
                    # Retry individually
                    for record in chunk:
                        try:
                            supabase.table("vocabulary_embeddings").upsert(
                                record,
                                on_conflict="word"
                            ).execute()
                            inserted_count += 1
                        except Exception:
                            print(f"      Failed: {record.get('word', 'unknown')}")
                    time.sleep(0.1)

            print(f"  ✓ Batch {batch_num} complete")

        except Exception as e:
            print(f"  ✗ Error in batch {batch_num}: {e}")
            continue

    print(f"\n✓ Vocabulary embedding complete!")
    print(f"  Inserted: {inserted_count} words")

    # Recreate index
    print("\nRecreating IVFFlat index...")
    try:
        supabase.rpc("recreate_vocabulary_index").execute()
        print("  ✓ Index recreated")
    except Exception as e:
        print(f"  ⚠ Could not recreate index: {e}")
        print("  Run manually: SELECT recreate_vocabulary_index();")


# ============================================
# MAIN
# ============================================

async def main():
    global openai_client, supabase

    # Parse args
    clean_first = "--clean" in sys.argv
    dry_run = "--dry-run" in sys.argv

    # Initialize clients
    openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("=" * 60)
    print("INS-001 Curated Vocabulary Embedding Script")
    print("=" * 60)
    print(f"Target size: {TARGET_VOCABULARY_SIZE} words")
    print(f"Min length: {MIN_WORD_LENGTH}, Max length: {MAX_WORD_LENGTH}")
    print(f"Clean first: {clean_first}")
    print(f"Dry run: {dry_run}")
    print("=" * 60)

    # Build vocabulary
    vocabulary = build_curated_vocabulary()

    # Clean if requested
    if clean_first and not dry_run:
        await clean_vocabulary_table()

    # Embed and insert
    await embed_and_insert_vocabulary(vocabulary, dry_run=dry_run)


if __name__ == "__main__":
    # Validate env vars
    if not SUPABASE_URL:
        print("ERROR: SUPABASE_URL not found")
        sys.exit(1)
    if not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_SERVICE_KEY not found")
        sys.exit(1)
    if not OPENAI_API_KEY:
        print("ERROR: OPENAI_API_KEY not found")
        sys.exit(1)

    asyncio.run(main())
