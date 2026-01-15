-- Migration 100b: Create New Tables
-- Run AFTER 100a

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

-- 5. Simplify users table (remove computed fields if they exist)
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

-- 7. Share tokens
CREATE TABLE share_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    is_active BOOLEAN DEFAULT TRUE
);

-- 8. Social edges
CREATE TABLE social_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    games_together INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_user_id, to_user_id)
);

SELECT 'Phase 100b: Tables created' as status;
