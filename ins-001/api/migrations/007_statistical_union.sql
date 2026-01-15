-- Migration: Create get_statistical_union function for INS-001.2
-- Finds words with minimum total embedding distance to both anchor and target
-- OPTIMIZED: Uses index-based pre-filtering instead of full vocabulary scan

-- Drop existing function if any
DROP FUNCTION IF EXISTS get_statistical_union(TEXT, TEXT, INT);

-- Create function that finds words closest to BOTH anchor and target
-- Score = sim(word, anchor) + sim(word, target) = 2 - dist(word, anchor) - dist(word, target)
-- Since we want highest similarity sum, we want lowest distance sum
--
-- OPTIMIZATION STRATEGY:
-- Instead of scanning all 30k words, we:
-- 1. Get top N candidates near the anchor (uses IVFFlat index)
-- 2. Get top N candidates near the target (uses IVFFlat index)
-- 3. Union these ~2N candidates (typically ~400 unique words)
-- 4. Score only these candidates by sum of similarities
-- This reduces computation from 30k*2 distance calcs to ~800 + 400*2 = ~1600
CREATE OR REPLACE FUNCTION get_statistical_union(
    anchor_embedding TEXT,
    target_embedding TEXT,
    k INT DEFAULT 10
)
RETURNS TABLE(word TEXT, score FLOAT, sim_anchor FLOAT, sim_target FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    anchor_vec halfvec(1536);
    target_vec halfvec(1536);
    candidate_limit INT;
BEGIN
    -- Convert JSON text to halfvec once (avoid repeated casting)
    anchor_vec := anchor_embedding::halfvec(1536);
    target_vec := target_embedding::halfvec(1536);

    -- Get more candidates than needed to ensure good coverage after scoring
    -- Rule of thumb: 20x the requested k, minimum 200
    candidate_limit := GREATEST(k * 20, 200);

    -- Pre-filter using index, then score only the candidates
    RETURN QUERY
    WITH
    anchor_neighbors AS (
        -- Get candidates near anchor (uses IVFFlat index)
        SELECT v.word, v.embedding
        FROM vocabulary_embeddings v
        ORDER BY v.embedding <=> anchor_vec
        LIMIT candidate_limit
    ),
    target_neighbors AS (
        -- Get candidates near target (uses IVFFlat index)
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_statistical_union(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_statistical_union(TEXT, TEXT, INT) TO service_role;

-- Verify
SELECT 'get_statistical_union function created successfully' as status;
