-- Migration 001: Initial Schema
-- INS-001 Semantic Associations
-- 
-- IMPORTANT: Run these in order in Supabase SQL Editor
-- halfvec requires pgvector 0.6.0+ (Supabase has this)

-- ============================================
-- EXTENSIONS (run first)
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================
-- VOCABULARY EMBEDDINGS
-- Uses halfvec (16-bit) to fit in Free tier
-- ============================================
CREATE TABLE vocabulary_embeddings (
    word TEXT PRIMARY KEY,
    embedding halfvec(1536),  -- NOT vector(1536)
    frequency_rank INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index MUST use halfvec_cosine_ops, NOT vector_cosine_ops
CREATE INDEX idx_vocab_embedding ON vocabulary_embeddings 
    USING ivfflat (embedding halfvec_cosine_ops) WITH (lists = 100);

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
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    recipient_id UUID REFERENCES auth.users(id),
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('network', 'stranger', 'llm')),
    
    seed_word TEXT NOT NULL,
    seed_word_sense TEXT,  -- For polysemous words: "flying mammal"
    seed_in_vocabulary BOOLEAN DEFAULT TRUE,  -- Was seed in vocabulary at creation?
    noise_floor JSONB NOT NULL,  -- [{word, score}]
    clues TEXT[],
    guesses TEXT[],
    
    divergence_score FLOAT,
    convergence_score FLOAT,
    
    status TEXT DEFAULT 'pending_clues' CHECK (status IN ('pending_clues', 'pending_guess', 'completed', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX idx_games_sender ON games(sender_id);
CREATE INDEX idx_games_recipient ON games(recipient_id);
CREATE INDEX idx_games_status ON games(status);
-- Partial index for analytics on open seeds (minority case)
CREATE INDEX idx_games_seed_not_in_vocab ON games(seed_in_vocabulary) WHERE seed_in_vocabulary = FALSE;

-- ============================================
-- SHARE TOKENS (separate from game_id)
-- ============================================
CREATE TABLE share_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_share_tokens_token ON share_tokens(token) WHERE is_active = TRUE;

-- ============================================
-- SOCIAL EDGES
-- ============================================
CREATE TABLE social_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    games_together INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_user_id, to_user_id)
);

-- ============================================
-- USER PROFILES (computed aggregates)
-- ============================================
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    divergence_mean FLOAT,
    divergence_std FLOAT,
    divergence_n INT DEFAULT 0,
    
    network_convergence_mean FLOAT,
    network_convergence_n INT DEFAULT 0,
    
    stranger_convergence_mean FLOAT,
    stranger_convergence_n INT DEFAULT 0,
    
    llm_convergence_mean FLOAT,
    llm_convergence_n INT DEFAULT 0,
    
    semantic_portability FLOAT,
    consistency_score FLOAT,
    archetype TEXT,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_embeddings ENABLE ROW LEVEL SECURITY;

-- Users: self only
CREATE POLICY users_self ON users
    FOR ALL USING (auth.uid() = id);

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

-- User profiles: self only
CREATE POLICY profiles_self ON user_profiles
    FOR ALL USING (user_id = auth.uid());

-- Vocabulary: public read
CREATE POLICY vocab_public_read ON vocabulary_embeddings
    FOR SELECT USING (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- LEGACY: Get noise floor for vocabulary seed words only
-- Kept for reference but unused - see get_noise_floor_by_embedding below
CREATE OR REPLACE FUNCTION get_noise_floor(
    seed_word_input TEXT,
    k INT DEFAULT 20
)
RETURNS TABLE(word TEXT, similarity FLOAT) AS $$
BEGIN
    RETURN QUERY
    WITH seed AS (
        SELECT embedding FROM vocabulary_embeddings WHERE word = lower(seed_word_input)
    )
    SELECT 
        v.word,
        (1 - (v.embedding <=> s.embedding))::FLOAT as similarity
    FROM vocabulary_embeddings v, seed s
    WHERE v.word != lower(seed_word_input)
    ORDER BY v.embedding <=> s.embedding
    LIMIT k;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ACTIVE: Get noise floor using a provided embedding vector
-- Essential for Open Seed mode - allows ANY word as seed
-- The embedding is computed on-demand by the backend via OpenAI
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

-- Join game via share token (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION join_game_via_token(share_token_input TEXT)
RETURNS TABLE(
    game_id UUID,
    seed_word TEXT,
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
    
    -- Return game details
    RETURN QUERY
    SELECT 
        g.id,
        g.seed_word,
        g.clues,
        g.noise_floor,
        u.display_name
    FROM games g
    JOIN users u ON g.sender_id = u.id
    WHERE g.id = v_game_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CRON JOBS
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
