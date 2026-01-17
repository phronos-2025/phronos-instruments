-- Migration 115b: Rebuild index with reduced parallel workers (Part 2)
--
-- Run this AFTER 115a_fix_functions.sql
-- Uses max_parallel_maintenance_workers = 1 to reduce memory requirement

-- Reduce parallel workers to minimize memory usage
SET max_parallel_maintenance_workers = 1;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_vocab_embedding;
DROP INDEX IF EXISTS vocabulary_embeddings_embedding_idx;

-- Create index with vector_cosine_ops
CREATE INDEX idx_vocab_embedding
ON vocabulary_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 10);

-- Update statistics
ANALYZE vocabulary_embeddings;

-- Verify
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'vocabulary_embeddings'
AND indexname = 'idx_vocab_embedding';

-- Quick test
SELECT * FROM get_statistical_union(
    (SELECT embedding::text FROM vocabulary_embeddings WHERE word = 'cat' LIMIT 1),
    (SELECT embedding::text FROM vocabulary_embeddings WHERE word = 'dog' LIMIT 1),
    5
);

SELECT 'Migration 115b: Index rebuilt with vector_cosine_ops (lists=10)' as status;
