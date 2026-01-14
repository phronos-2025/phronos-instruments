-- INS-001.2: Lexical Bridge
-- Migration: 004_lexical_bridge.sql
-- Description: Adds function to find optimal semantic path between words

-- =============================================================================
-- LEXICAL BRIDGE COLUMN
-- =============================================================================

-- Add lexical_bridge column to games_bridging table
ALTER TABLE games_bridging
ADD COLUMN IF NOT EXISTS lexical_bridge TEXT[];

COMMENT ON COLUMN games_bridging.lexical_bridge IS 'Optimal embedding-based path between anchor and target (same step count as user)';

-- =============================================================================
-- LEXICAL BRIDGE FUNCTION
-- =============================================================================

-- Find the nearest vocabulary word to an interpolated embedding point
-- Used for computing the "lexical bridge" - the algorithmically optimal path
CREATE OR REPLACE FUNCTION get_nearest_word_excluding(
    query_embedding halfvec(1536),
    exclude_words TEXT[],
    k INT DEFAULT 1
)
RETURNS TABLE(word TEXT, embedding halfvec(1536), similarity FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.word,
        v.embedding,
        (1 - (v.embedding <=> query_embedding))::FLOAT as similarity
    FROM vocabulary_embeddings v
    WHERE v.word != ALL(exclude_words)
    ORDER BY v.embedding <=> query_embedding
    LIMIT k;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_nearest_word_excluding IS 'Find nearest vocabulary word to an embedding, excluding specified words. Used for lexical bridge computation.';
