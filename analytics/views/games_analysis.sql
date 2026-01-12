-- Analytics View: Completed Games
-- 
-- Provides comprehensive game data for Jupyter notebook analysis
-- Access via service key (bypasses RLS for research)

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE OR REPLACE VIEW analytics.games_complete AS
SELECT 
    g.id,
    g.created_at,
    g.recipient_type,
    g.seed_word,
    g.seed_in_vocabulary,
    g.clues,
    g.guesses,
    g.divergence_score,
    g.convergence_score,
    g.status,
    u_sender.is_anonymous AS sender_anonymous,
    u_recipient.is_anonymous AS recipient_anonymous,
    u_sender.created_at AS sender_created_at,
    u_recipient.created_at AS recipient_created_at
FROM games g
LEFT JOIN users u_sender ON g.sender_id = u_sender.id
LEFT JOIN users u_recipient ON g.recipient_id = u_recipient.id
WHERE g.status = 'completed';

-- Grant access to service role (for Jupyter notebooks)
GRANT USAGE ON SCHEMA analytics TO service_role;
GRANT SELECT ON analytics.games_complete TO service_role;
