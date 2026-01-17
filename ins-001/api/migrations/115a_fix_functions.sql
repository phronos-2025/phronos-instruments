-- Migration 115a: Fix functions to use vector type (Part 1 - Functions only)
--
-- ISSUE: The embedding column is type `vector` but functions use `halfvec`
-- FIX: Update functions to use `vector` type to match the column

-- 1. First, confirm the column type
SELECT
    column_name,
    udt_name as column_type
FROM information_schema.columns
WHERE table_name = 'vocabulary_embeddings'
AND column_name = 'embedding';

-- ============================================
-- 2. get_statistical_union - use vector type
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
-- 3. get_noise_floor_by_embedding - use vector type
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
-- 4. get_distant_words - use vector type
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
-- 5. get_nearest_word_excluding - use vector type
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

SELECT 'Migration 115a: Functions updated to use vector type' as status;
