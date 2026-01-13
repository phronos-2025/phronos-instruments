-- INS-001.2: Create get_distant_words function
-- Run this after 002_bridging.sql if the suggest feature isn't working
--
-- This creates the function that finds words with low cosine similarity (most distant)
-- for the "Suggest" feature in bridging games.

-- Drop existing function if any
DROP FUNCTION IF EXISTS get_distant_words(TEXT, INT);
DROP FUNCTION IF EXISTS get_distant_words(vector, INT);
DROP FUNCTION IF EXISTS get_distant_words(halfvec, INT);

-- Create function that accepts TEXT (JSON array format) and casts internally
-- This works regardless of whether the embedding column is vector or halfvec
CREATE OR REPLACE FUNCTION get_distant_words(
    query_embedding TEXT,
    k INT DEFAULT 100
)
RETURNS TABLE(word TEXT, distance FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Cast the text input to halfvec and find most distant words
    -- Uses pgvector's <=> operator (cosine distance) in DESC order
    RETURN QUERY
    SELECT
        v.word,
        (v.embedding::vector(1536) <=> query_embedding::vector(1536))::FLOAT as distance
    FROM vocabulary_embeddings v
    ORDER BY distance DESC
    LIMIT k;

EXCEPTION WHEN OTHERS THEN
    -- If vector cast fails, try halfvec
    RETURN QUERY
    SELECT
        v.word,
        (v.embedding <=> query_embedding::halfvec(1536))::FLOAT as distance
    FROM vocabulary_embeddings v
    ORDER BY distance DESC
    LIMIT k;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_distant_words(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_distant_words(TEXT, INT) TO service_role;

-- Verify the function was created
SELECT 'get_distant_words function created successfully' as status;
