-- Migration 114: Check and fix vocabulary embedding index
--
-- ISSUE: get_statistical_union is timing out
-- This usually means the IVFFlat index isn't being used or has wrong operator class
--
-- ROOT CAUSE: Index may have been created with vector_cosine_ops but column is halfvec
-- FIX: Recreate index with halfvec_cosine_ops

-- 1. Check existing indexes on vocabulary_embeddings
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'vocabulary_embeddings';

-- 2. Check the embedding column type
SELECT
    column_name,
    udt_name
FROM information_schema.columns
WHERE table_name = 'vocabulary_embeddings'
AND column_name = 'embedding';

-- 3. Check table size
SELECT
    relname as table_name,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE relname = 'vocabulary_embeddings';

-- 4. Drop and recreate the index with correct operator class for halfvec
DROP INDEX IF EXISTS idx_vocab_embedding;
DROP INDEX IF EXISTS vocabulary_embeddings_embedding_idx;

-- Create index with halfvec_cosine_ops (for <=> cosine distance)
-- Using 25 lists for ~50K rows (sqrt(rows) rule of thumb)
CREATE INDEX idx_vocab_embedding
ON vocabulary_embeddings
USING ivfflat (embedding halfvec_cosine_ops)
WITH (lists = 25);

-- 5. Analyze the table to update statistics
ANALYZE vocabulary_embeddings;

-- 6. Verify index was created correctly
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'vocabulary_embeddings'
AND indexname = 'idx_vocab_embedding';

-- 7. Quick test - this should be fast now
SELECT * FROM get_statistical_union(
    (SELECT embedding::text FROM vocabulary_embeddings WHERE word = 'cat' LIMIT 1),
    (SELECT embedding::text FROM vocabulary_embeddings WHERE word = 'dog' LIMIT 1),
    5
);

SELECT 'Migration 114: Index rebuilt with halfvec_cosine_ops and analyzed' as status;
