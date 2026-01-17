-- Migration 116: Consolidated fix for vector type consistency
--
-- PROBLEM: Migrations 112-115b conflicted with each other:
--   - 112 set functions to vector, 113 reverted to halfvec
--   - 114 created index with halfvec_cosine_ops
--   - 115/115a/115b tried to fix but order-dependent
--
-- This migration definitively sets:
--   - All functions use vector(1536)
--   - Index uses vector_cosine_ops
--
-- Run this to fix the type mismatch causing statement timeouts.

-- ============================================
-- 1. Verify column type (should be 'vector')
-- ============================================
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT udt_name INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vocabulary_embeddings'
      AND column_name = 'embedding';

    RAISE NOTICE 'Column type: %', col_type;

    IF col_type != 'vector' THEN
        RAISE EXCEPTION 'Expected embedding column to be vector, got %', col_type;
    END IF;
END $$;

-- ============================================
-- 2. get_statistical_union
-- ============================================
DROP FUNCTION IF EXISTS public.get_statistical_union(TEXT, TEXT, INT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_statistical_union(
    anchor_embedding TEXT,
    target_embedding TEXT,
    k INT DEFAULT 10
)
RETURNS TABLE(word TEXT, score FLOAT, sim_anchor FLOAT, sim_target FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    anchor_vec vector(1536);
    target_vec vector(1536);
    candidate_limit INT;
BEGIN
    anchor_vec := anchor_embedding::vector(1536);
    target_vec := target_embedding::vector(1536);

    candidate_limit := GREATEST(k * 20, 200);

    RETURN QUERY
    WITH
    anchor_neighbors AS (
        SELECT v.word, v.embedding
        FROM vocabulary_embeddings v
        ORDER BY v.embedding <=> anchor_vec
        LIMIT candidate_limit
    ),
    target_neighbors AS (
        SELECT v.word, v.embedding
        FROM vocabulary_embeddings v
        ORDER BY v.embedding <=> target_vec
        LIMIT candidate_limit
    ),
    candidates AS (
        SELECT * FROM anchor_neighbors
        UNION
        SELECT * FROM target_neighbors
    )
    SELECT
        c.word,
        (2.0 - (c.embedding <=> anchor_vec) - (c.embedding <=> target_vec))::FLOAT as score,
        (1.0 - (c.embedding <=> anchor_vec))::FLOAT as sim_anchor,
        (1.0 - (c.embedding <=> target_vec))::FLOAT as sim_target
    FROM candidates c
    ORDER BY score DESC
    LIMIT k;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_statistical_union(TEXT, TEXT, INT) TO authenticated, service_role;

-- ============================================
-- 3. get_noise_floor_by_embedding
-- ============================================
DROP FUNCTION IF EXISTS public.get_noise_floor_by_embedding(TEXT, TEXT, INT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_noise_floor_by_embedding(
    seed_embedding TEXT,
    seed_word TEXT,
    k INT DEFAULT 20
)
RETURNS TABLE(word TEXT, similarity FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    seed_vec vector(1536);
BEGIN
    seed_vec := seed_embedding::vector(1536);

    RETURN QUERY
    SELECT
        v.word,
        (1 - (v.embedding <=> seed_vec))::FLOAT as similarity
    FROM vocabulary_embeddings v
    WHERE v.word != lower(seed_word)
    ORDER BY v.embedding <=> seed_vec
    LIMIT k;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_noise_floor_by_embedding(TEXT, TEXT, INT) TO authenticated, service_role;

-- ============================================
-- 4. get_distant_words
-- ============================================
DROP FUNCTION IF EXISTS public.get_distant_words(TEXT, INT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_distant_words(
    query_embedding TEXT,
    k INT DEFAULT 100
)
RETURNS TABLE(word TEXT, distance FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    query_vec vector(1536);
BEGIN
    query_vec := query_embedding::vector(1536);

    RETURN QUERY
    SELECT
        v.word,
        (v.embedding <=> query_vec)::FLOAT as distance
    FROM vocabulary_embeddings v
    ORDER BY v.embedding <=> query_vec DESC
    LIMIT k;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_distant_words(TEXT, INT) TO authenticated, service_role;

-- ============================================
-- 5. get_nearest_word_excluding
-- ============================================
DROP FUNCTION IF EXISTS public.get_nearest_word_excluding(TEXT, TEXT[], INT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_nearest_word_excluding(
    query_embedding TEXT,
    exclude_words TEXT[],
    k INT DEFAULT 1
)
RETURNS TABLE(word TEXT, similarity FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    query_vec vector(1536);
BEGIN
    query_vec := query_embedding::vector(1536);

    RETURN QUERY
    SELECT
        v.word,
        (1 - (v.embedding <=> query_vec))::FLOAT as similarity
    FROM vocabulary_embeddings v
    WHERE v.word != ALL(exclude_words)
    ORDER BY v.embedding <=> query_vec
    LIMIT k;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nearest_word_excluding(TEXT, TEXT[], INT) TO authenticated, service_role;

-- ============================================
-- 6. Rebuild index with vector_cosine_ops
-- ============================================
-- NOTE: Run this section separately if it times out
-- Increase memory limit for index build
SET maintenance_work_mem = '128MB';
SET max_parallel_maintenance_workers = 0;

DROP INDEX IF EXISTS idx_vocab_embedding;
DROP INDEX IF EXISTS vocabulary_embeddings_embedding_idx;

-- Create index with vector_cosine_ops (matches vector column type)
-- Using lists = 30 for faster build (still good for ~30K rows)
CREATE INDEX idx_vocab_embedding
ON vocabulary_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 30);

-- Update statistics for query planner
ANALYZE vocabulary_embeddings;

-- ============================================
-- 7. Verify
-- ============================================
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'vocabulary_embeddings'
AND indexname = 'idx_vocab_embedding';

-- Quick test - should complete in < 100ms
SELECT * FROM get_statistical_union(
    (SELECT embedding::text FROM vocabulary_embeddings WHERE word = 'cat' LIMIT 1),
    (SELECT embedding::text FROM vocabulary_embeddings WHERE word = 'dog' LIMIT 1),
    5
);

SELECT 'Migration 116: Functions and index now consistently use vector type' as status;
