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

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from wordfreq import top_n_list
from openai import AsyncOpenAI
from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY
from app.services.embeddings import EMBEDDING_MODEL

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
            # Use upsert which handles conflicts automatically
            result = supabase.table("vocabulary_embeddings").upsert(
                records,
                on_conflict="word"
            ).execute()
            
            # Upsert returns all records (both new and existing)
            # We can't easily distinguish, so just count total processed
            inserted_count += len(records)
            
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
        print("      USING ivfflat (embedding halfvec_cosine_ops) WITH (lists = 100);")


if __name__ == "__main__":
    print("=" * 60)
    print("INS-001 Vocabulary Embedding Script")
    print("=" * 60)
    print(f"Vocabulary size: {VOCABULARY_SIZE} words")
    print(f"Batch size: {BATCH_SIZE} words")
    print(f"Estimated cost: ~$0.50 (75K tokens)")
    print("=" * 60)
    
    asyncio.run(embed_vocabulary())
