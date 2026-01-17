-- Migration 113: Fix vector operators
--
-- ISSUE: Functions with SET search_path = '' can't find the <=> operator
-- The operator is in the public schema, same as the types
--
-- FIX: Use SET search_path = 'public' to find both tables and operators
-- Since everything is in public schema, this is safe.

-- ============================================
-- 1. get_statistical_union
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
    anchor_vec halfvec(1536);
    target_vec halfvec(1536);
    candidate_limit INT;
BEGIN
    -- Cast JSON text to halfvec (matches embedding column type)
    anchor_vec := anchor_embedding::halfvec(1536);
    target_vec := target_embedding::halfvec(1536);

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
-- 2. get_noise_floor_by_embedding
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
    seed_vec halfvec(1536);
BEGIN
    seed_vec := seed_embedding::halfvec(1536);

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
-- 3. get_distant_words
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
    query_vec halfvec(1536);
BEGIN
    query_vec := query_embedding::halfvec(1536);

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
-- 4. get_nearest_word_excluding
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
    query_vec halfvec(1536);
BEGIN
    query_vec := query_embedding::halfvec(1536);

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
-- Verify
-- ============================================
SELECT 'Migration 113: Functions fixed with search_path = public and halfvec type' as status;

-- Quick test
SELECT * FROM get_statistical_union(
    (SELECT embedding::text FROM vocabulary_embeddings WHERE word = 'cat' LIMIT 1),
    (SELECT embedding::text FROM vocabulary_embeddings WHERE word = 'dog' LIMIT 1),
    3
);
