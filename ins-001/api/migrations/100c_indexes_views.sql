-- Migration 100c: Create Indexes and Views
-- Run AFTER 100b

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

SELECT 'Phase 100c: Indexes and views created' as status;
