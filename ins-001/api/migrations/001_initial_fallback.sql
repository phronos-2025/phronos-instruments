-- Migration 001: Initial Schema (FALLBACK - uses vector instead of halfvec)
-- INS-001 Semantic Associations
-- 
-- Use this if halfvec extension is not available in Supabase
-- This uses vector(1536) instead of halfvec(1536)
-- Storage: ~300MB instead of ~150MB (still fits in free tier)

-- ============================================
-- EXTENSIONS (run first)
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;
-- Note: pg_cron may not be available on free tier - that's OK

-- ============================================
-- VOCABULARY EMBEDDINGS
-- Uses vector (32-bit) - fallback if halfvec not available
-- ============================================
CREATE TABLE vocabulary_embeddings (
    word TEXT PRIMARY KEY,
    embedding vector(1536),  -- Using vector instead of halfvec
    frequency_rank INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index uses vector_cosine_ops (not halfvec_cosine_ops)
CREATE INDEX idx_vocab_embedding ON vocabulary_embeddings 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- USERS (extends Supabase Auth)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    games_played INT DEFAULT 0,
    profile_ready BOOLEAN DEFAULT FALSE,
    is_anonymous BOOLEAN DEFAULT FALSE,
    terms_accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to sync is_anonymous from auth.users
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

-- ============================================
-- GAMES
-- ============================================
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('network', 'stranger', 'llm')),
    seed_word TEXT NOT NULL,
    seed_word_sense TEXT,  -- For polysemous words: "flying mammal"
    seed_in_vocabulary BOOLEAN,  -- Analytics: was seed in vocab at creation?
    noise_floor JSONB NOT NULL,  -- [{word: "dog", similarity: 0.85}, ...]
    clues TEXT[],
    guesses TEXT[],
    divergence_score FLOAT,
    convergence_score FLOAT,
    status TEXT NOT NULL DEFAULT 'pending_clues' CHECK (status IN ('pending_clues', 'pending_guess', 'completed', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

-- ============================================
-- SHARE TOKENS
-- ============================================
CREATE TABLE share_tokens (
    token TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER PROFILES
-- ============================================
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Divergence stats
    divergence_mean FLOAT,
    divergence_std FLOAT,
    divergence_n INT DEFAULT 0,
    
    -- Convergence stats by recipient type
    network_convergence_mean FLOAT,
    network_convergence_n INT DEFAULT 0,
    
    stranger_convergence_mean FLOAT,
    stranger_convergence_n INT DEFAULT 0,
    
    llm_convergence_mean FLOAT,
    llm_convergence_n INT DEFAULT 0,
    
    -- Derived metrics
    semantic_portability FLOAT,  -- stranger_conv / network_conv
    consistency_score FLOAT,    -- 1 - (std / mean)
    archetype TEXT,             -- "Creative Communicator", etc.
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SOCIAL EDGES (for future network features)
-- ============================================
CREATE TABLE social_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    edge_type TEXT NOT NULL CHECK (edge_type IN ('friend', 'block')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_user_id, to_user_id, edge_type)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_embeddings ENABLE ROW LEVEL SECURITY;

-- Users: Can read own record, can update own record
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Games: Can read games where you're sender or recipient
CREATE POLICY "Users can read own games" ON games
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can create games" ON games
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own games" ON games
    FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Share tokens: Can read if you're the sender
CREATE POLICY "Senders can read share tokens" ON share_tokens
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM games 
            WHERE games.id = share_tokens.game_id 
            AND games.sender_id = auth.uid()
        )
    );

-- User profiles: Can read own profile
CREATE POLICY "Users can read own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Social edges: Can read edges involving you
CREATE POLICY "Users can read own edges" ON social_edges
    FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Vocabulary: Read-only for all authenticated users
CREATE POLICY "Authenticated users can read vocabulary" ON vocabulary_embeddings
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================
-- SQL FUNCTIONS
-- ============================================

-- Get noise floor using a provided embedding vector
-- UPDATED: Uses vector instead of halfvec
CREATE OR REPLACE FUNCTION get_noise_floor_by_embedding(
    seed_embedding vector(1536),  -- Changed from halfvec(1536)
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
    WHERE v.word != seed_word
    ORDER BY v.embedding <=> seed_embedding
    LIMIT k;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Join game via share token (SECURITY DEFINER to bypass RLS)
-- SECURITY FIX: Does NOT return seed_word (revealed only after guessing)
CREATE OR REPLACE FUNCTION join_game_via_token(share_token_input TEXT)
RETURNS TABLE(
    game_id UUID,
    clues TEXT[],
    noise_floor JSONB,
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
    SELECT g.status, g.sender_id, g.recipient_id 
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
    
    -- Return game details (seed_word NOT included - security fix)
    RETURN QUERY
    SELECT 
        g.id,
        g.clues,
        g.noise_floor,
        u.display_name
    FROM games g
    JOIN users u ON g.sender_id = u.id
    WHERE g.id = v_game_id;
END;
$$ LANGUAGE plpgsql;

-- Function to recreate vocabulary index after data load
-- UPDATED: Uses vector instead of halfvec
CREATE OR REPLACE FUNCTION recreate_vocabulary_index()
RETURNS void AS $$
BEGIN
    DROP INDEX IF EXISTS idx_vocab_embedding;
    CREATE INDEX idx_vocab_embedding ON vocabulary_embeddings 
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CRON JOBS (Optional - may not work on free tier)
-- ============================================

-- Expire old games (hourly)
-- Note: This may fail if pg_cron is not available - that's OK
-- Commented out by default - uncomment if pg_cron is enabled
-- SELECT cron.schedule('expire-games', '0 * * * *', $$
--     UPDATE games SET status = 'expired' 
--     WHERE status IN ('pending_clues', 'pending_guess') 
--     AND expires_at < NOW()
-- $$);

-- Clean up anonymous users (daily at 3am)
-- Commented out by default - uncomment if pg_cron is enabled
-- SELECT cron.schedule('cleanup-anon-users', '0 3 * * *', $$
--     DELETE FROM auth.users 
--     WHERE id IN (
--         SELECT u.id FROM users u
--         WHERE u.is_anonymous = true 
--         AND u.created_at < NOW() - INTERVAL '30 days'
--         AND u.id NOT IN (
--             SELECT DISTINCT sender_id FROM games WHERE sender_id IS NOT NULL
--             UNION
--             SELECT DISTINCT recipient_id FROM games WHERE recipient_id IS NOT NULL
--         )
--     )
-- $$);
