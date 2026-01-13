-- INS-001.2: Semantic Bridging
-- Migration: 002_bridging.sql
-- Description: Creates tables and policies for the bridging game variant

-- =============================================================================
-- GAMES TABLE
-- =============================================================================

CREATE TABLE games_bridging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Sender info
    sender_id UUID REFERENCES auth.users(id) NOT NULL,

    -- Bridge definition
    anchor_word TEXT NOT NULL,
    target_word TEXT NOT NULL,
    clues TEXT[] NOT NULL,  -- Array of 1-5 clues

    -- Computed scores (calculated on clue submission via embeddings)
    divergence_score NUMERIC(5,2),

    -- Recipient info (populated when someone guesses)
    recipient_id UUID REFERENCES auth.users(id),
    recipient_type TEXT CHECK (recipient_type IN ('human', 'haiku')),

    -- Recipient guesses (human or from share link)
    guessed_anchor TEXT,
    guessed_target TEXT,

    -- Reconstruction scores (calculated via embeddings after guess)
    reconstruction_score NUMERIC(5,2),
    anchor_similarity NUMERIC(5,2),
    target_similarity NUMERIC(5,2),
    order_swapped BOOLEAN,
    exact_anchor_match BOOLEAN,
    exact_target_match BOOLEAN,

    -- Haiku reconstruction (LLM-based, generative baseline)
    haiku_guessed_anchor TEXT,
    haiku_guessed_target TEXT,
    haiku_reconstruction_score NUMERIC(5,2),

    -- Statistical baseline (embedding-based, deterministic)
    statistical_guessed_anchor TEXT,
    statistical_guessed_target TEXT,
    statistical_baseline_score NUMERIC(5,2),

    -- Game state
    status TEXT DEFAULT 'pending_clues'
        CHECK (status IN ('pending_clues', 'pending_guess', 'completed', 'expired')),
    share_code TEXT UNIQUE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT anchor_target_different CHECK (anchor_word != target_word),
    CONSTRAINT clues_not_empty CHECK (array_length(clues, 1) >= 1),
    CONSTRAINT clues_max_five CHECK (array_length(clues, 1) <= 5)
);

-- Add comments for documentation
COMMENT ON TABLE games_bridging IS 'INS-001.2: Semantic Bridging games where users create conceptual bridges between two words';
COMMENT ON COLUMN games_bridging.divergence_score IS 'How far clues arc from the direct anchor-target path (0-100 scale)';
COMMENT ON COLUMN games_bridging.reconstruction_score IS 'How accurately recipient recovered anchor-target pair (0-100 scale)';
COMMENT ON COLUMN games_bridging.order_swapped IS 'True if recipient guessed anchor/target in swapped order';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Primary access patterns
CREATE INDEX idx_games_bridging_sender ON games_bridging(sender_id);
CREATE INDEX idx_games_bridging_recipient ON games_bridging(recipient_id);
CREATE INDEX idx_games_bridging_status ON games_bridging(status);

-- Share code lookup (partial index for non-null only)
CREATE INDEX idx_games_bridging_share_code ON games_bridging(share_code)
    WHERE share_code IS NOT NULL;

-- Time-based queries
CREATE INDEX idx_games_bridging_created ON games_bridging(created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE games_bridging ENABLE ROW LEVEL SECURITY;

-- Users can view games where they are sender or recipient
CREATE POLICY "Users can view own games as sender or recipient"
    ON games_bridging FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Users can create games (must be the sender)
CREATE POLICY "Users can create games"
    ON games_bridging FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- Sender can update their own games (submit clues, create share)
CREATE POLICY "Sender can update own games"
    ON games_bridging FOR UPDATE
    USING (auth.uid() = sender_id);

-- Service role can update any game (for recipient assignment, scoring)
-- This is handled by using service_role key in backend

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to join a game via share code (atomic operation)
CREATE OR REPLACE FUNCTION join_bridging_game_via_code(
    p_share_code TEXT,
    p_recipient_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_game_id UUID;
    v_sender_id UUID;
    v_current_recipient UUID;
    v_status TEXT;
BEGIN
    -- Get game details
    SELECT id, sender_id, recipient_id, status
    INTO v_game_id, v_sender_id, v_current_recipient, v_status
    FROM games_bridging
    WHERE share_code = p_share_code;

    -- Validate game exists
    IF v_game_id IS NULL THEN
        RAISE EXCEPTION 'Invalid share code';
    END IF;

    -- Validate game is in correct state
    IF v_status != 'pending_guess' THEN
        RAISE EXCEPTION 'Game is not accepting guesses';
    END IF;

    -- Prevent self-play
    IF v_sender_id = p_recipient_id THEN
        RAISE EXCEPTION 'Cannot join your own game';
    END IF;

    -- Check if already has a recipient
    IF v_current_recipient IS NOT NULL THEN
        RAISE EXCEPTION 'Game already has a recipient';
    END IF;

    -- Assign recipient
    UPDATE games_bridging
    SET recipient_id = p_recipient_id,
        recipient_type = 'human'
    WHERE id = v_game_id;

    RETURN v_game_id;
END;
$$;

-- Function to generate a unique share code
CREATE OR REPLACE FUNCTION generate_bridging_share_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 8-character alphanumeric code
        v_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);

        -- Check if it already exists
        SELECT EXISTS(SELECT 1 FROM games_bridging WHERE share_code = v_code)
        INTO v_exists;

        EXIT WHEN NOT v_exists;
    END LOOP;

    RETURN v_code;
END;
$$;

-- Function to get distant words (lowest cosine similarity)
-- Used for the "Suggest" feature in bridging games
-- Auto-detects whether to use halfvec or vector based on vocabulary_embeddings table
DO $$
DECLARE
    embedding_udt_name TEXT;
BEGIN
    -- Get the UDT name (halfvec or vector)
    SELECT udt_name INTO embedding_udt_name
    FROM information_schema.columns
    WHERE table_name = 'vocabulary_embeddings' AND column_name = 'embedding';

    -- Drop any existing function
    DROP FUNCTION IF EXISTS get_distant_words(halfvec, INT) CASCADE;
    DROP FUNCTION IF EXISTS get_distant_words(vector, INT) CASCADE;

    IF embedding_udt_name = 'halfvec' THEN
        EXECUTE '
            CREATE OR REPLACE FUNCTION get_distant_words(
                query_embedding halfvec(1536),
                k INT DEFAULT 100
            )
            RETURNS TABLE(word TEXT, distance FLOAT) AS $func$
            BEGIN
                RETURN QUERY
                SELECT
                    v.word,
                    (v.embedding <=> query_embedding)::FLOAT as distance
                FROM vocabulary_embeddings v
                ORDER BY v.embedding <=> query_embedding DESC
                LIMIT k;
            END;
            $func$ LANGUAGE plpgsql SECURITY DEFINER;
        ';
        RAISE NOTICE 'Created get_distant_words with halfvec';
    ELSE
        EXECUTE '
            CREATE OR REPLACE FUNCTION get_distant_words(
                query_embedding vector(1536),
                k INT DEFAULT 100
            )
            RETURNS TABLE(word TEXT, distance FLOAT) AS $func$
            BEGIN
                RETURN QUERY
                SELECT
                    v.word,
                    (v.embedding <=> query_embedding)::FLOAT as distance
                FROM vocabulary_embeddings v
                ORDER BY v.embedding <=> query_embedding DESC
                LIMIT k;
            END;
            $func$ LANGUAGE plpgsql SECURITY DEFINER;
        ';
        RAISE NOTICE 'Created get_distant_words with vector';
    END IF;
END;
$$;

-- =============================================================================
-- PROFILE VIEW
-- =============================================================================

-- Aggregated view of user bridging performance
CREATE VIEW user_bridging_profile AS
SELECT
    sender_id,
    COUNT(*) as games_played,
    AVG(divergence_score) as mean_divergence,
    STDDEV(divergence_score) as divergence_sd,
    -- Human reconstruction stats
    AVG(reconstruction_score) FILTER (WHERE recipient_type = 'human') as mean_human_reconstruction,
    COUNT(*) FILTER (WHERE recipient_type = 'human') as human_games_count,
    -- Haiku (LLM) reconstruction stats
    AVG(haiku_reconstruction_score) as mean_haiku_reconstruction,
    -- Statistical (embedding) baseline stats
    AVG(statistical_baseline_score) as mean_statistical_baseline,
    -- Comparison ratios
    AVG(reconstruction_score) FILTER (WHERE recipient_type = 'human') /
        NULLIF(AVG(haiku_reconstruction_score), 0) as human_vs_haiku_ratio,
    AVG(reconstruction_score) FILTER (WHERE recipient_type = 'human') /
        NULLIF(AVG(statistical_baseline_score), 0) as human_vs_statistical_ratio
FROM games_bridging
WHERE status = 'completed'
GROUP BY sender_id;

COMMENT ON VIEW user_bridging_profile IS 'Aggregated bridging game performance metrics per user';
