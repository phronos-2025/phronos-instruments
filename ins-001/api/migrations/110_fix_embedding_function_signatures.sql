-- Migration 110: Fix embedding function signatures for PostgREST compatibility
--
-- Issue: Migration 104 used public.halfvec(1536) as parameter types, but
-- PostgREST/Supabase client sends embeddings as JSON arrays which need
-- to be cast to the vector type inside the function.
--
-- Fix: Accept TEXT parameters (JSON arrays) and cast to halfvec internally.

-- ============================================
-- 1. get_noise_floor_by_embedding
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
    -- Cast JSON text to halfvec
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
-- 2. get_distant_words (halfvec version -> TEXT version)
-- ============================================
DROP FUNCTION IF EXISTS public.get_distant_words(public.halfvec, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_distant_words(halfvec, INT) CASCADE;
-- Keep TEXT version from migration 104, just ensure it exists

CREATE OR REPLACE FUNCTION public.get_distant_words(
    query_embedding TEXT,
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
-- 3. get_nearest_word_excluding
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

SELECT 'Migration 110: Embedding function signatures fixed for PostgREST' as status;
