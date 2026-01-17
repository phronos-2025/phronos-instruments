-- Migration 111: Ensure embedding function signatures are correct
--
-- This migration ensures all embedding functions have the correct signatures
-- for PostgREST compatibility. It consolidates fixes from migrations 109 and 110.
--
-- The issue: Migration 104 may have overwritten the correct function signatures
-- if migrations were applied out of order. This migration ensures the correct
-- signatures regardless of previous state.
--
-- Functions fixed:
-- 1. get_statistical_union: Accepts TEXT (JSON arrays) for embeddings
-- 2. get_noise_floor_by_embedding: Accepts TEXT for embedding
-- 3. get_distant_words: Accepts TEXT for embedding
-- 4. get_nearest_word_excluding: Accepts TEXT for embedding

-- ============================================
-- 1. get_statistical_union
-- ============================================
-- Drop ALL versions to ensure clean state
DROP FUNCTION IF EXISTS public.get_statistical_union(TEXT, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_statistical_union(public.halfvec, public.halfvec, INT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_statistical_union(
    anchor_embedding TEXT,  -- JSON array, will be cast to halfvec
    target_embedding TEXT,  -- JSON array, will be cast to halfvec
    k INT DEFAULT 10
)
RETURNS TABLE(word TEXT, score FLOAT, sim_anchor FLOAT, sim_target FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    anchor_vec public.halfvec(1536);
    target_vec public.halfvec(1536);
    candidate_limit INT;
BEGIN
    -- Cast JSON text to halfvec once
    anchor_vec := anchor_embedding::public.halfvec(1536);
    target_vec := target_embedding::public.halfvec(1536);

    -- Get more candidates than needed to ensure good coverage after scoring
    candidate_limit := GREATEST(k * 20, 200);

    -- Pre-filter using index, then score only the candidates
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
-- 2. get_noise_floor_by_embedding
-- ============================================
DROP FUNCTION IF EXISTS public.get_noise_floor_by_embedding(public.halfvec, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_noise_floor_by_embedding(halfvec, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_noise_floor_by_embedding(TEXT, TEXT, INT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_noise_floor_by_embedding(
    seed_embedding TEXT,  -- JSON array, will be cast to halfvec
    seed_word TEXT,
    k INT DEFAULT 20
)
RETURNS TABLE(word TEXT, similarity FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    seed_vec public.halfvec(1536);
BEGIN
    seed_vec := seed_embedding::public.halfvec(1536);

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
-- 3. get_distant_words (TEXT version only)
-- ============================================
DROP FUNCTION IF EXISTS public.get_distant_words(public.halfvec, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_distant_words(halfvec, INT) CASCADE;
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
    query_vec public.halfvec(1536);
BEGIN
    query_vec := query_embedding::public.halfvec(1536);

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
-- 4. get_nearest_word_excluding
-- ============================================
DROP FUNCTION IF EXISTS public.get_nearest_word_excluding(public.halfvec, TEXT[], INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_nearest_word_excluding(halfvec, TEXT[], INT) CASCADE;
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
    query_vec public.halfvec(1536);
BEGIN
    query_vec := query_embedding::public.halfvec(1536);

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
SELECT 'Migration 111: All embedding functions have correct TEXT signatures' as status;

-- Show function signatures for verification
SELECT
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('get_statistical_union', 'get_noise_floor_by_embedding', 'get_distant_words', 'get_nearest_word_excluding')
ORDER BY p.proname;
