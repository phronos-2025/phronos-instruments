"""
Vocabulary Embedding Script - INS-001 Semantic Associations

Loads top 50K English words from wordfreq and embeds them using OpenAI.
Inserts into vocabulary_embeddings table with halfvec(1536) format.

Usage:
    python scripts/embed_vocabulary.py

Requirements:
    - wordfreq: pip install wordfreq
    - OPENAI_API_KEY environment variable
    - SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables
"""

import os
import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from custom location if specified
# Default: look for .env in script directory, or use ENV_FILE environment variable
env_file = os.environ.get("ENV_FILE", None)
if env_file:
    load_dotenv(env_file)
else:
    # Try default locations
    script_dir = Path(__file__).parent.parent
    default_env = script_dir / ".env"
    if default_env.exists():
        load_dotenv(default_env)
    else:
        # Try user's custom location
        custom_env = Path("/Users/vishal/Documents/Secrets/instruments-keys.env")
        if custom_env.exists():
            load_dotenv(custom_env)

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from wordfreq import top_n_list
from openai import AsyncOpenAI
from supabase import create_client, Client

# Get env vars directly (don't use app.config which may not have them loaded)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
EMBEDDING_MODEL = "text-embedding-3-small"

# Configuration
BATCH_SIZE = 2000  # OpenAI limit is 2048 per call
VOCABULARY_SIZE = 50000

# Initialize clients
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


async def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Get embeddings for a batch of texts."""
    response = await openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts
    )
    return [item.embedding for item in response.data]


async def embed_vocabulary():
    """Main function to embed vocabulary."""
    print(f"Extracting top {VOCABULARY_SIZE} English words from wordfreq...")
    words = top_n_list('en', VOCABULARY_SIZE)
    print(f"Extracted {len(words)} words")
    
    total_batches = (len(words) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"Will process {total_batches} batches of up to {BATCH_SIZE} words each")
    
    inserted_count = 0
    
    for i in range(0, len(words), BATCH_SIZE):
        batch = words[i:i+BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        
        print(f"\nProcessing batch {batch_num}/{total_batches} ({len(batch)} words)...")
        
        try:
            # Get embeddings for batch
            print("  Fetching embeddings from OpenAI...")
            embeddings = await get_embeddings_batch(batch)
            
            # Prepare data for insertion
            records = []
            for word, embedding, rank in zip(batch, embeddings, range(i, i+len(batch))):
                records.append({
                    "word": word.lower().strip(),
                    "embedding": embedding,  # Will be converted to halfvec by Supabase
                    "frequency_rank": rank
                })
            
            # Insert with idempotency (ON CONFLICT DO NOTHING)
            print(f"  Inserting {len(records)} records into database...")
            
            # Use upsert in smaller chunks to avoid timeout
            # Supabase has a limit on batch size and query timeout
            # Vector embeddings are large, so use small chunks
            CHUNK_SIZE = 50  # Insert 50 records at a time to avoid timeout
            import time
            
            for chunk_start in range(0, len(records), CHUNK_SIZE):
                chunk = records[chunk_start:chunk_start + CHUNK_SIZE]
                chunk_num = chunk_start // CHUNK_SIZE + 1
                total_chunks = (len(records) + CHUNK_SIZE - 1) // CHUNK_SIZE
                
                try:
                    result = supabase.table("vocabulary_embeddings").upsert(
                        chunk,
                        on_conflict="word"
                    ).execute()
                    inserted_count += len(chunk)
                    if chunk_num % 10 == 0:  # Print progress every 10 chunks
                        print(f"    Inserted chunk {chunk_num}/{total_chunks} ({chunk_num * CHUNK_SIZE}/{len(records)} records)")
                except Exception as chunk_error:
                    print(f"    ⚠ Warning: Chunk {chunk_num} failed: {chunk_error}")
                    # Try individual inserts for this chunk (slower but more reliable)
                    print(f"    Retrying chunk {chunk_num} with individual inserts...")
                    for record in chunk:
                        try:
                            supabase.table("vocabulary_embeddings").upsert(
                                record,
                                on_conflict="word"
                            ).execute()
                            inserted_count += 1
                        except Exception as individual_error:
                            print(f"      Failed to insert word: {record.get('word', 'unknown')}")
                    # Small delay to avoid rate limiting
                    time.sleep(0.1)
            
            print(f"  ✓ Batch {batch_num} complete")
            
        except Exception as e:
            print(f"  ✗ Error in batch {batch_num}: {e}")
            print(f"  Resuming from batch {batch_num + 1}...")
            continue
    
    print(f"\n✓ Vocabulary embedding complete!")
    print(f"  Processed: {inserted_count} words")
    print(f"  (Upsert handles conflicts automatically - existing words are updated)")
    
    # Recreate IVFFlat index AFTER data load (better clustering)
    print("\nRecreating IVFFlat index for better clustering...")
    try:
        result = supabase.rpc("recreate_vocabulary_index").execute()
        print("  ✓ Index recreated successfully")
    except Exception as e:
        print(f"  ⚠ Warning: Could not recreate index automatically: {e}")
        print("  You may need to run this SQL manually in Supabase SQL Editor:")
        print("  SELECT recreate_vocabulary_index();")
        print("  Or:")
        print("  DROP INDEX IF EXISTS idx_vocab_embedding;")
        print("  CREATE INDEX idx_vocab_embedding ON vocabulary_embeddings")
        print("      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);")


if __name__ == "__main__":
    # Validate required env vars
    if not SUPABASE_URL:
        print("ERROR: SUPABASE_URL not found in environment")
        print("Set ENV_FILE=/path/to/your/.env or ensure SUPABASE_URL is set")
        sys.exit(1)
    if not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_SERVICE_KEY not found in environment")
        print("Set ENV_FILE=/path/to/your/.env or ensure SUPABASE_SERVICE_KEY is set")
        sys.exit(1)
    if not OPENAI_API_KEY:
        print("ERROR: OPENAI_API_KEY not found in environment")
        print("Set ENV_FILE=/path/to/your/.env or ensure OPENAI_API_KEY is set")
        sys.exit(1)
    
    print("=" * 60)
    print("INS-001 Vocabulary Embedding Script")
    print("=" * 60)
    print(f"Vocabulary size: {VOCABULARY_SIZE} words")
    print(f"Batch size: {BATCH_SIZE} words")
    print(f"Estimated cost: ~$0.50 (75K tokens)")
    print(f"Supabase URL: {SUPABASE_URL[:30]}...")
    print("=" * 60)
    
    asyncio.run(embed_vocabulary())
