-- Migration 109: Fix get_statistical_union function signature
--
-- Migration 104 incorrectly changed the function signature from
-- (anchor_embedding TEXT, target_embedding TEXT, k INT) to
-- (anchor_word TEXT, target_word TEXT, k INT)
--
-- The API calls it with embedding JSON arrays, not word names.
-- This migration restores the correct signature with search_path fix.

-- Drop the incorrect version
DROP FUNCTION IF EXISTS public.get_statistical_union(TEXT, TEXT, INT) CASCADE;

-- Recreate with correct signature (embedding TEXT = JSON array)
CREATE OR REPLACE FUNCTION public.get_statistical_union(
    anchor_embedding TEXT,
    target_embedding TEXT,
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
    -- Convert JSON text to halfvec once (avoid repeated casting)
    anchor_vec := anchor_embedding::public.halfvec(1536);
    target_vec := target_embedding::public.halfvec(1536);

    -- Get more candidates than needed to ensure good coverage after scoring
    -- Rule of thumb: 20x the requested k, minimum 200
    candidate_limit := GREATEST(k * 20, 200);

    -- Pre-filter using index, then score only the candidates
    RETURN QUERY
    WITH
    anchor_neighbors AS (
        -- Get candidates near anchor (uses IVFFlat index)
        SELECT v.word, v.embedding
        FROM public.vocabulary_embeddings v
        ORDER BY v.embedding <=> anchor_vec
        LIMIT candidate_limit
    ),
    target_neighbors AS (
        -- Get candidates near target (uses IVFFlat index)
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_statistical_union(TEXT, TEXT, INT) TO authenticated, service_role;

SELECT 'Migration 109: get_statistical_union signature fixed' as status;
