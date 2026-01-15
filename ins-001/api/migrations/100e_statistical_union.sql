-- Migration 100e: Statistical Union Function
-- Run AFTER 100d

-- Get statistical union (optimal path between anchor and target)
CREATE OR REPLACE FUNCTION get_statistical_union(
    anchor_word TEXT,
    target_word TEXT,
    k INT DEFAULT 5
)
RETURNS TABLE(word TEXT, score FLOAT, sim_anchor FLOAT, sim_target FLOAT) AS $$
DECLARE
    anchor_emb halfvec(1536);
    target_emb halfvec(1536);
BEGIN
    -- Get anchor embedding
    SELECT embedding INTO anchor_emb
    FROM vocabulary_embeddings WHERE vocabulary_embeddings.word = lower(anchor_word);

    -- Get target embedding
    SELECT embedding INTO target_emb
    FROM vocabulary_embeddings WHERE vocabulary_embeddings.word = lower(target_word);

    IF anchor_emb IS NULL OR target_emb IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH candidates AS (
        -- Get candidates near anchor
        (
            SELECT v.word, v.embedding
            FROM vocabulary_embeddings v
            WHERE v.word NOT IN (lower(anchor_word), lower(target_word))
            ORDER BY v.embedding <=> anchor_emb
            LIMIT 500
        )
        UNION
        -- Get candidates near target
        (
            SELECT v.word, v.embedding
            FROM vocabulary_embeddings v
            WHERE v.word NOT IN (lower(anchor_word), lower(target_word))
            ORDER BY v.embedding <=> target_emb
            LIMIT 500
        )
    )
    SELECT DISTINCT ON (c.word)
        c.word,
        ((1 - (c.embedding <=> anchor_emb)) + (1 - (c.embedding <=> target_emb)))::FLOAT as score,
        (1 - (c.embedding <=> anchor_emb))::FLOAT as sim_anchor,
        (1 - (c.embedding <=> target_emb))::FLOAT as sim_target
    FROM candidates c
    ORDER BY c.word, score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Phase 100e: Statistical union function created' as status;
