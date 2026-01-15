-- Migration 100: Schema Reset for Forward Compatibility
-- INS-001 Database Redesign
--
-- IMPORTANT: This migration wipes all game data and rebuilds the schema.
-- Vocabulary embeddings are preserved and updated with model version tracking.
--
-- Run this in Supabase SQL Editor in order.

-- ============================================
-- PHASE 1: CLEANUP OLD SCHEMA
-- ============================================

-- Drop views first (dependencies)
DROP VIEW IF EXISTS user_bridging_profile CASCADE;

-- Drop cron jobs
SELECT cron.unschedule('expire-games');
SELECT cron.unschedule('cleanup-anon-users');

-- Drop old functions
DROP FUNCTION IF EXISTS get_noise_floor(TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS get_noise_floor_by_embedding(halfvec, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS get_distant_words(halfvec, INT) CASCADE;
DROP FUNCTION IF EXISTS get_distant_words(vector, INT) CASCADE;
DROP FUNCTION IF EXISTS get_nearest_word_excluding(halfvec, TEXT[], INT) CASCADE;
DROP FUNCTION IF EXISTS get_statistical_union(TEXT, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS join_game_via_token(TEXT) CASCADE;
DROP FUNCTION IF EXISTS join_bridging_game_via_code(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS generate_bridging_share_code() CASCADE;
DROP FUNCTION IF EXISTS recreate_vocabulary_index() CASCADE;
DROP FUNCTION IF EXISTS sync_user_anonymous_status() CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop tables in dependency order
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS share_tokens CASCADE;
DROP TABLE IF EXISTS games_bridging CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS social_edges CASCADE;

-- ============================================
-- PHASE 2: CREATE NEW TABLES
-- ============================================

-- 1. Instruments registry
CREATE TABLE instruments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL,
    config JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE instruments IS 'Registry of cognitive assessment instruments (INS-001, INS-002, etc.)';

-- 2. System configuration
CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE system_config IS 'System-wide configuration for models and algorithms';

-- 3. Model versions (immutable log)
CREATE TABLE model_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_type TEXT NOT NULL CHECK (model_type IN ('embedding', 'llm', 'scoring')),
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    config JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deprecated_at TIMESTAMPTZ,
    UNIQUE(model_type, model_name, model_version)
);

COMMENT ON TABLE model_versions IS 'Immutable log of all model versions used for reproducibility';

-- 4. Update vocabulary_embeddings (add model_version_id)
ALTER TABLE vocabulary_embeddings
ADD COLUMN IF NOT EXISTS model_version_id UUID REFERENCES model_versions(id);

-- 5. Simplify users table
ALTER TABLE users DROP COLUMN IF EXISTS games_played;
ALTER TABLE users DROP COLUMN IF EXISTS profile_ready;

-- 6. Unified games table
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_version INT NOT NULL DEFAULT 1,
    instrument_id TEXT NOT NULL REFERENCES instruments(id),
    game_type TEXT NOT NULL CHECK (game_type IN ('radiation', 'bridging')),

    -- Participants
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    recipient_id UUID REFERENCES auth.users(id),
    recipient_type TEXT CHECK (recipient_type IN ('network', 'stranger', 'llm')),

    -- Model versions used (immutable after creation)
    embedding_model_id UUID REFERENCES model_versions(id),
    llm_model_id UUID REFERENCES model_versions(id),
    scoring_version TEXT,

    -- Game data (flexible JSONB)
    setup JSONB NOT NULL,
    sender_input JSONB,
    recipient_input JSONB,
    sender_scores JSONB,
    recipient_scores JSONB,
    baselines JSONB,

    -- Status
    status TEXT DEFAULT 'pending_clues'
        CHECK (status IN ('pending_clues', 'pending_guess', 'completed', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

COMMENT ON TABLE games IS 'Unified game table for all instrument types with versioned JSONB payloads';
COMMENT ON COLUMN games.setup IS 'Game setup: {seed_word, sense, noise_floor} for radiation, {anchor, target} for bridging';
COMMENT ON COLUMN games.sender_input IS 'Sender submission: {clues: [...]}';
COMMENT ON COLUMN games.recipient_input IS 'Recipient submission: {guesses: [...]} or {clues: [...]}';
COMMENT ON COLUMN games.sender_scores IS 'Computed scores: {divergence, relevance, percentile, ...}';
COMMENT ON COLUMN games.recipient_scores IS 'Recipient scores: {convergence, ...} or {bridge_similarity, ...}';
COMMENT ON COLUMN games.baselines IS 'Baseline comparisons: {llm: {...}, lexical: {...}}';

-- 7. Share tokens (unchanged structure)
CREATE TABLE share_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    is_active BOOLEAN DEFAULT TRUE
);

-- 8. Social edges (unchanged structure)
CREATE TABLE social_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    games_together INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_user_id, to_user_id)
);

-- ============================================
-- PHASE 3: CREATE INDEXES
-- ============================================

-- Games indexes
CREATE INDEX idx_games_sender ON games(sender_id);
CREATE INDEX idx_games_recipient ON games(recipient_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_instrument ON games(instrument_id);
CREATE INDEX idx_games_game_type ON games(game_type);
CREATE INDEX idx_games_created ON games(created_at DESC);
CREATE INDEX idx_games_expires ON games(expires_at) WHERE status IN ('pending_clues', 'pending_guess');

-- GIN indexes for JSONB queries
CREATE INDEX idx_games_setup ON games USING GIN (setup);
CREATE INDEX idx_games_sender_scores ON games USING GIN (sender_scores);

-- Share tokens
CREATE INDEX idx_share_tokens_token ON share_tokens(token) WHERE is_active = TRUE;
CREATE INDEX idx_share_tokens_game ON share_tokens(game_id);

-- ============================================
-- PHASE 4: CREATE VIEWS
-- ============================================

-- User profiles (computed view, always fresh)
CREATE VIEW user_profiles AS
WITH stats AS (
    SELECT
        u.id as user_id,
        u.display_name,
        u.is_anonymous,
        u.created_at as user_created_at,
        COUNT(g.id) as games_played,
        -- Divergence stats
        AVG((g.sender_scores->>'divergence')::FLOAT) as divergence_mean,
        STDDEV((g.sender_scores->>'divergence')::FLOAT) as divergence_std,
        COUNT(*) FILTER (WHERE g.sender_scores->>'divergence' IS NOT NULL) as divergence_n,
        -- Convergence by recipient type
        AVG((g.recipient_scores->>'convergence')::FLOAT)
            FILTER (WHERE g.recipient_type = 'network') as network_convergence_mean,
        AVG((g.recipient_scores->>'convergence')::FLOAT)
            FILTER (WHERE g.recipient_type = 'stranger') as stranger_convergence_mean,
        AVG((g.recipient_scores->>'convergence')::FLOAT)
            FILTER (WHERE g.recipient_type = 'llm') as llm_convergence_mean,
        -- Game counts by recipient type
        COUNT(*) FILTER (WHERE g.recipient_type = 'network') as network_games,
        COUNT(*) FILTER (WHERE g.recipient_type = 'stranger') as stranger_games,
        COUNT(*) FILTER (WHERE g.recipient_type = 'llm') as llm_games,
        -- Game counts by type
        COUNT(*) FILTER (WHERE g.game_type = 'radiation') as radiation_games,
        COUNT(*) FILTER (WHERE g.game_type = 'bridging') as bridging_games
    FROM users u
    LEFT JOIN games g ON u.id = g.sender_id AND g.status = 'completed'
    GROUP BY u.id, u.display_name, u.is_anonymous, u.created_at
)
SELECT
    user_id,
    display_name,
    is_anonymous,
    user_created_at,
    games_played,
    divergence_mean,
    divergence_std,
    divergence_n,
    network_convergence_mean,
    stranger_convergence_mean,
    llm_convergence_mean,
    network_games,
    stranger_games,
    llm_games,
    radiation_games,
    bridging_games,
    -- Computed fields
    games_played >= 15 as profile_ready,
    CASE WHEN network_convergence_mean > 0 THEN
        stranger_convergence_mean / network_convergence_mean
    END as semantic_portability,
    CASE WHEN divergence_mean > 0 AND divergence_std IS NOT NULL THEN
        GREATEST(0, 1 - (divergence_std / divergence_mean))
    END as consistency_score,
    -- Archetype computation
    CASE
        WHEN games_played < 15 THEN 'Emerging'
        WHEN divergence_mean >= 50 AND COALESCE(network_convergence_mean, 0) >= 0.6
            AND COALESCE(stranger_convergence_mean, 0) >= 0.6
            THEN 'Creative Communicator'
        WHEN divergence_mean >= 50 AND COALESCE(network_convergence_mean, 0) >= 0.6
            AND COALESCE(stranger_convergence_mean, 0) < 0.6
            THEN 'In-Group Creator'
        WHEN divergence_mean >= 50 AND COALESCE(network_convergence_mean, 0) < 0.6
            THEN 'Idiosyncratic'
        WHEN divergence_mean < 50 AND COALESCE(network_convergence_mean, 0) >= 0.6
            AND COALESCE(stranger_convergence_mean, 0) >= 0.6
            THEN 'Conventional Coordinator'
        WHEN divergence_mean < 50 AND COALESCE(network_convergence_mean, 0) < 0.6
            THEN 'Communication Difficulty'
        ELSE 'Emerging'
    END as archetype
FROM stats;

COMMENT ON VIEW user_profiles IS 'Computed user profile aggregates with archetypes';

-- ============================================
-- PHASE 5: CREATE FUNCTIONS
-- ============================================

-- User sync trigger (recreate)
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

-- Join game via share token
CREATE OR REPLACE FUNCTION join_game_via_token(share_token_input TEXT)
RETURNS TABLE(
    game_id UUID,
    game_type TEXT,
    setup JSONB,
    sender_input JSONB,
    sender_display_name TEXT
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_game_id UUID;
    v_recipient_id UUID;
    v_game_status TEXT;
    v_game_sender_id UUID;
BEGIN
    v_recipient_id := auth.uid();

    IF v_recipient_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock token row to prevent race condition
    SELECT st.game_id INTO v_game_id
    FROM share_tokens st
    WHERE st.token = share_token_input
      AND st.is_active = TRUE
      AND st.expires_at > NOW()
    FOR UPDATE;

    IF v_game_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired share token';
    END IF;

    -- Get game details
    SELECT g.status, g.sender_id
    INTO v_game_status, v_game_sender_id
    FROM games g
    WHERE g.id = v_game_id;

    -- Prevent self-play
    IF v_game_sender_id = v_recipient_id THEN
        RAISE EXCEPTION 'You cannot join your own game';
    END IF;

    -- Check game state
    IF v_game_status = 'pending_clues' THEN
        RAISE EXCEPTION 'The sender has not finished writing clues yet';
    END IF;

    IF v_game_status != 'pending_guess' THEN
        RAISE EXCEPTION 'This game is no longer available';
    END IF;

    -- Check if already has recipient
    IF EXISTS (SELECT 1 FROM games WHERE id = v_game_id AND recipient_id IS NOT NULL) THEN
        RAISE EXCEPTION 'This game already has a recipient';
    END IF;

    -- Assign recipient
    UPDATE games SET recipient_id = v_recipient_id WHERE id = v_game_id;

    -- Deactivate token
    UPDATE share_tokens SET is_active = FALSE WHERE token = share_token_input;

    -- Return game details (setup does NOT include seed_word for radiation games - security)
    RETURN QUERY
    SELECT
        g.id,
        g.game_type,
        CASE
            WHEN g.game_type = 'radiation' THEN
                jsonb_build_object('noise_floor', g.setup->'noise_floor')
            ELSE
                g.setup
        END,
        g.sender_input,
        u.display_name
    FROM games g
    JOIN users u ON g.sender_id = u.id
    WHERE g.id = v_game_id;
END;
$$ LANGUAGE plpgsql;

-- Vocabulary index recreation function
CREATE OR REPLACE FUNCTION recreate_vocabulary_index()
RETURNS void AS $$
BEGIN
    DROP INDEX IF EXISTS idx_vocab_embedding;
    CREATE INDEX idx_vocab_embedding ON vocabulary_embeddings
        USING ivfflat (embedding halfvec_cosine_ops) WITH (lists = 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PHASE 6: ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on new tables
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_edges ENABLE ROW LEVEL SECURITY;

-- Instruments: public read
CREATE POLICY instruments_public_read ON instruments
    FOR SELECT USING (true);

-- System config: public read (no secrets here)
CREATE POLICY system_config_public_read ON system_config
    FOR SELECT USING (true);

-- Model versions: public read
CREATE POLICY model_versions_public_read ON model_versions
    FOR SELECT USING (true);

-- Games: sender can do everything
CREATE POLICY games_sender ON games
    FOR ALL USING (sender_id = auth.uid());

-- Games: recipient can read
CREATE POLICY games_recipient ON games
    FOR SELECT USING (recipient_id = auth.uid());

-- Share tokens: public read (needed for join flow)
CREATE POLICY share_tokens_public_read ON share_tokens
    FOR SELECT USING (true);

-- Share tokens: only sender can create
CREATE POLICY share_tokens_sender_insert ON share_tokens
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM games WHERE id = game_id AND sender_id = auth.uid())
    );

-- Social edges: participants can read
CREATE POLICY edges_participant ON social_edges
    FOR SELECT USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- ============================================
-- PHASE 7: CRON JOBS
-- ============================================

-- Expire old games (hourly)
SELECT cron.schedule('expire-games', '0 * * * *', $$
    UPDATE games SET status = 'expired'
    WHERE status IN ('pending_clues', 'pending_guess')
    AND expires_at < NOW()
$$);

-- Clean up anonymous users (daily at 3am)
SELECT cron.schedule('cleanup-anon-users', '0 3 * * *', $$
    DELETE FROM auth.users
    WHERE id IN (
        SELECT u.id FROM users u
        WHERE u.is_anonymous = true
        AND u.created_at < NOW() - INTERVAL '30 days'
        AND u.id NOT IN (
            SELECT DISTINCT sender_id FROM games WHERE sender_id IS NOT NULL
            UNION
            SELECT DISTINCT recipient_id FROM games WHERE recipient_id IS NOT NULL
        )
    )
$$);

-- ============================================
-- PHASE 8: SEED REFERENCE DATA
-- ============================================

-- Insert instruments
INSERT INTO instruments (id, name, description, version, config) VALUES
    ('INS-001', 'Semantic Associations',
     'Measures semantic creativity and communicability through word association games',
     '0.3.2',
     '{"num_clues": 5, "num_guesses": 3, "noise_floor_k": 20, "profile_threshold_games": 15}');

-- Insert model versions
INSERT INTO model_versions (model_type, model_name, model_version, config) VALUES
    ('embedding', 'openai', 'text-embedding-3-small', '{"dimensions": 1536, "cost_per_million_tokens": 0.02}'),
    ('llm', 'anthropic', 'claude-haiku-4-5-20251001', '{"temperature": 0.3}'),
    ('scoring', 'phronos', 'v3.1', '{"relevance_threshold": 0.15, "divergence_scale": 100}');

-- Insert system config
INSERT INTO system_config (key, value) VALUES
    ('embedding_model', '"text-embedding-3-small"'),
    ('llm_model', '"claude-haiku-4-5-20251001"'),
    ('scoring_version', '"v3.1"'),
    ('schema_version', '1');

-- ============================================
-- PHASE 9: LINK VOCABULARY TO MODEL VERSION
-- ============================================

UPDATE vocabulary_embeddings
SET model_version_id = (
    SELECT id FROM model_versions
    WHERE model_type = 'embedding'
    AND model_name = 'openai'
    AND model_version = 'text-embedding-3-small'
);

-- ============================================
-- VERIFICATION
-- ============================================

-- Check all tables exist
DO $$
DECLARE
    missing_tables TEXT[];
BEGIN
    SELECT array_agg(t) INTO missing_tables
    FROM unnest(ARRAY['instruments', 'system_config', 'model_versions', 'games', 'share_tokens', 'social_edges']) t
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = t
    );

    IF missing_tables IS NOT NULL THEN
        RAISE EXCEPTION 'Missing tables: %', missing_tables;
    END IF;

    RAISE NOTICE 'All tables created successfully';
END $$;

-- Check vocabulary has model_version_id
DO $$
DECLARE
    unlinked_count INT;
BEGIN
    SELECT COUNT(*) INTO unlinked_count
    FROM vocabulary_embeddings
    WHERE model_version_id IS NULL;

    IF unlinked_count > 0 THEN
        RAISE WARNING '% vocabulary embeddings not linked to model version', unlinked_count;
    ELSE
        RAISE NOTICE 'All vocabulary embeddings linked to model version';
    END IF;
END $$;

SELECT 'Migration 100_reset_schema.sql completed successfully' as status;
