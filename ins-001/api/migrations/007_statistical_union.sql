-- Migration: Create get_statistical_union function for INS-001.2
-- Finds words with minimum total embedding distance to both anchor and target
-- Full vocabulary scan done server-side for performance

-- Drop existing function if any
DROP FUNCTION IF EXISTS get_statistical_union(TEXT, TEXT, INT);

-- Create function that finds words closest to BOTH anchor and target
-- Score = sim(word, anchor) + sim(word, target) = 2 - dist(word, anchor) - dist(word, target)
-- Since we want highest similarity sum, we want lowest distance sum
CREATE OR REPLACE FUNCTION get_statistical_union(
    anchor_embedding TEXT,
    target_embedding TEXT,
    k INT DEFAULT 10
)
RETURNS TABLE(word TEXT, score FLOAT, sim_anchor FLOAT, sim_target FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Cosine similarity = 1 - cosine distance
    -- Score = sim_anchor + sim_target = 2 - dist_anchor - dist_target
    -- We order by score DESC (highest similarity sum first)
    RETURN QUERY
    SELECT
        v.word,
        (2.0 - (v.embedding::vector(1536) <=> anchor_embedding::vector(1536))
             - (v.embedding::vector(1536) <=> target_embedding::vector(1536)))::FLOAT as score,
        (1.0 - (v.embedding::vector(1536) <=> anchor_embedding::vector(1536)))::FLOAT as sim_anchor,
        (1.0 - (v.embedding::vector(1536) <=> target_embedding::vector(1536)))::FLOAT as sim_target
    FROM vocabulary_embeddings v
    ORDER BY score DESC
    LIMIT k;

EXCEPTION WHEN OTHERS THEN
    -- If vector cast fails, try halfvec
    RETURN QUERY
    SELECT
        v.word,
        (2.0 - (v.embedding <=> anchor_embedding::halfvec(1536))
             - (v.embedding <=> target_embedding::halfvec(1536)))::FLOAT as score,
        (1.0 - (v.embedding <=> anchor_embedding::halfvec(1536)))::FLOAT as sim_anchor,
        (1.0 - (v.embedding <=> target_embedding::halfvec(1536)))::FLOAT as sim_target
    FROM vocabulary_embeddings v
    ORDER BY score DESC
    LIMIT k;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_statistical_union(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_statistical_union(TEXT, TEXT, INT) TO service_role;

-- Verify
SELECT 'get_statistical_union function created successfully' as status;
