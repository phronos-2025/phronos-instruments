-- Migration 100d: Create Functions
-- Run AFTER 100c

-- User sync trigger
CREATE OR REPLACE FUNCTION sync_user_anonymous_status()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, is_anonymous, created_at)
    VALUES (
        NEW.id,
        NEW.is_anonymous,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET is_anonymous = NEW.is_anonymous;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION sync_user_anonymous_status();

-- Get noise floor by embedding (for open seed mode)
CREATE OR REPLACE FUNCTION get_noise_floor_by_embedding(
    seed_embedding halfvec(1536),
    seed_word TEXT,
    k INT DEFAULT 20
)
RETURNS TABLE(word TEXT, similarity FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.word,
        (1 - (v.embedding <=> seed_embedding))::FLOAT as similarity
    FROM vocabulary_embeddings v
    WHERE v.word != lower(seed_word)
    ORDER BY v.embedding <=> seed_embedding
    LIMIT k;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get distant words (for bridging suggestions)
CREATE OR REPLACE FUNCTION get_distant_words(
    query_embedding halfvec(1536),
    k INT DEFAULT 100
)
RETURNS TABLE(word TEXT, distance FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.word,
        (v.embedding <=> query_embedding)::FLOAT as distance
    FROM vocabulary_embeddings v
    ORDER BY v.embedding <=> query_embedding DESC
    LIMIT k;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get nearest word excluding (for lexical bridge)
CREATE OR REPLACE FUNCTION get_nearest_word_excluding(
    query_embedding halfvec(1536),
    exclude_words TEXT[],
    k INT DEFAULT 1
)
RETURNS TABLE(word TEXT, similarity FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.word,
        (1 - (v.embedding <=> query_embedding))::FLOAT as similarity
    FROM vocabulary_embeddings v
    WHERE v.word != ALL(exclude_words)
    ORDER BY v.embedding <=> query_embedding
    LIMIT k;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vocabulary index recreation function (auto-detects vector vs halfvec)
CREATE OR REPLACE FUNCTION recreate_vocabulary_index()
RETURNS void AS $$
DECLARE
    embedding_type TEXT;
BEGIN
    -- Detect the actual column type
    SELECT udt_name INTO embedding_type
    FROM information_schema.columns
    WHERE table_name = 'vocabulary_embeddings' AND column_name = 'embedding';

    DROP INDEX IF EXISTS idx_vocab_embedding;

    IF embedding_type = 'halfvec' THEN
        CREATE INDEX idx_vocab_embedding ON vocabulary_embeddings
            USING ivfflat (embedding halfvec_cosine_ops) WITH (lists = 25);
    ELSE
        CREATE INDEX idx_vocab_embedding ON vocabulary_embeddings
            USING ivfflat (embedding vector_cosine_ops) WITH (lists = 25);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Phase 100d: Basic functions created' as status;
