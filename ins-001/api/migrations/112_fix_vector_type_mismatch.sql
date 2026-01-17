-- Migration 112: Fix vector type mismatch in embedding functions
--
-- ISSUE: The vocabulary_embeddings table stores embeddings as `vector` type,
-- but the functions cast input to `halfvec` type. The <=> operator doesn't
-- work between different vector types.
--
-- ERROR: operator does not exist: public.vector <=> public.halfvec
--
-- FIX: Cast embeddings to the same type before comparison. We'll cast to vector
-- since that's what's stored in the table.

-- First, check what type is actually stored
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT udt_name INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vocabulary_embeddings'
      AND column_name = 'embedding';

    RAISE NOTICE 'vocabulary_embeddings.embedding type: %', col_type;
END $$;

-- ============================================
-- 1. get_statistical_union - use vector type
-- ============================================
DROP FUNCTION IF EXISTS public.get_statistical_union(TEXT, TEXT, INT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_statistical_union(
    anchor_embedding TEXT,  -- JSON array
    target_embedding TEXT,  -- JSON array
    k INT DEFAULT 10
)
RETURNS TABLE(word TEXT, score FLOAT, sim_anchor FLOAT, sim_target FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    anchor_vec public.vector(1536);
    target_vec public.vector(1536);
    candidate_limit INT;
BEGIN
    -- Cast JSON text to vector (same type as stored in table)
    anchor_vec := anchor_embedding::public.vector(1536);
    target_vec := target_embedding::public.vector(1536);

    candidate_limit := GREATEST(k * 20, 200);

    RETURN QUERY
    WITH
    anchor_neighbors AS (
        SELECT v.word, v.embedding
        FROM public.vocabulary_embeddings v
        ORDER BY v.embedding <=> anchor_vec
        LIMIT candidate_limit
    ),
    target_neighbors AS (
        SELECT v.word, v.embedding
        FROM public.vocabulary_embeddings v
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
-- 2. get_noise_floor_by_embedding - use vector type
-- ============================================
DROP FUNCTION IF EXISTS public.get_noise_floor_by_embedding(TEXT, TEXT, INT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_noise_floor_by_embedding(
    seed_embedding TEXT,  -- JSON array
    seed_word TEXT,
    k INT DEFAULT 20
)
RETURNS TABLE(word TEXT, similarity FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    seed_vec public.vector(1536);
BEGIN
    seed_vec := seed_embedding::public.vector(1536);

    RETURN QUERY
    SELECT
        v.word,
        (1 - (v.embedding <=> seed_vec))::FLOAT as similarity
    FROM public.vocabulary_embeddings v
    WHERE v.word != lower(seed_word)
    ORDER BY v.embedding <=> seed_vec
    LIMIT k;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_noise_floor_by_embedding(TEXT, TEXT, INT) TO authenticated, service_role;

-- ============================================
-- 3. get_distant_words - use vector type
-- ============================================
DROP FUNCTION IF EXISTS public.get_distant_words(TEXT, INT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_distant_words(
    query_embedding TEXT,  -- JSON array
    k INT DEFAULT 100
)
RETURNS TABLE(word TEXT, distance FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    query_vec public.vector(1536);
BEGIN
    query_vec := query_embedding::public.vector(1536);

    RETURN QUERY
    SELECT
        v.word,
        (v.embedding <=> query_vec)::FLOAT as distance
    FROM public.vocabulary_embeddings v
    ORDER BY v.embedding <=> query_vec DESC
    LIMIT k;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_distant_words(TEXT, INT) TO authenticated, service_role;

-- ============================================
-- 4. get_nearest_word_excluding - use vector type
-- ============================================
DROP FUNCTION IF EXISTS public.get_nearest_word_excluding(TEXT, TEXT[], INT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_nearest_word_excluding(
    query_embedding TEXT,  -- JSON array
    exclude_words TEXT[],
    k INT DEFAULT 1
)
RETURNS TABLE(word TEXT, similarity FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    query_vec public.vector(1536);
BEGIN
    query_vec := query_embedding::public.vector(1536);

    RETURN QUERY
    SELECT
        v.word,
        (1 - (v.embedding <=> query_vec))::FLOAT as similarity
    FROM public.vocabulary_embeddings v
    WHERE v.word != ALL(exclude_words)
    ORDER BY v.embedding <=> query_vec
    LIMIT k;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nearest_word_excluding(TEXT, TEXT[], INT) TO authenticated, service_role;

-- ============================================
-- Verify
-- ============================================
SELECT 'Migration 112: Fixed vector type mismatch - using vector instead of halfvec' as status;

-- Show function signatures
SELECT
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('get_statistical_union', 'get_noise_floor_by_embedding', 'get_distant_words', 'get_nearest_word_excluding')
ORDER BY p.proname;
