-- INS-001.2 v2: Bridge-vs-Bridge Comparison
-- Migration: 003_bridging_v2.sql
-- Description: Redesign recipient flow to build their own bridge
--
-- KEY CHANGE: Recipients now see anchor + target and build their own clues,
-- rather than trying to guess the words from clues alone.

-- =============================================================================
-- NEW COLUMNS FOR BRIDGE-VS-BRIDGE
-- =============================================================================

-- Recipient's bridge (their clues connecting anchor-target)
ALTER TABLE games_bridging
ADD COLUMN IF NOT EXISTS recipient_clues TEXT[];

-- Bridge similarity score (how similar the two bridges are)
ALTER TABLE games_bridging
ADD COLUMN IF NOT EXISTS bridge_similarity NUMERIC(5,2);

-- Recipient's divergence (how creative was their bridge)
ALTER TABLE games_bridging
ADD COLUMN IF NOT EXISTS recipient_divergence NUMERIC(5,2);

-- Haiku's bridge (generated clues, not guessed words)
ALTER TABLE games_bridging
ADD COLUMN IF NOT EXISTS haiku_clues TEXT[];

-- Haiku's bridge similarity to sender
ALTER TABLE games_bridging
ADD COLUMN IF NOT EXISTS haiku_bridge_similarity NUMERIC(5,2);

-- Haiku's divergence
ALTER TABLE games_bridging
ADD COLUMN IF NOT EXISTS haiku_divergence NUMERIC(5,2);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN games_bridging.recipient_clues IS 'Recipient''s clues connecting anchor-target (their bridge)';
COMMENT ON COLUMN games_bridging.bridge_similarity IS 'Cosine similarity between sender and recipient clue centroids (0-100)';
COMMENT ON COLUMN games_bridging.recipient_divergence IS 'How far recipient''s clues arc from the direct path (0-100)';
COMMENT ON COLUMN games_bridging.haiku_clues IS 'Haiku-generated clues connecting anchor-target';
COMMENT ON COLUMN games_bridging.haiku_bridge_similarity IS 'Similarity between sender and Haiku bridges (0-100)';
COMMENT ON COLUMN games_bridging.haiku_divergence IS 'How creative Haiku''s bridge was (0-100)';

-- =============================================================================
-- UPDATE VIEW
-- =============================================================================

-- Drop and recreate the profile view with new columns
DROP VIEW IF EXISTS user_bridging_profile;

CREATE VIEW user_bridging_profile AS
SELECT
    sender_id,
    COUNT(*) as games_played,
    AVG(divergence_score) as mean_divergence,
    STDDEV(divergence_score) as divergence_sd,
    -- Human bridge similarity (new metric)
    AVG(bridge_similarity) FILTER (WHERE recipient_type = 'human') as mean_human_bridge_similarity,
    COUNT(*) FILTER (WHERE recipient_type = 'human') as human_games_count,
    -- Haiku bridge similarity (new metric)
    AVG(haiku_bridge_similarity) as mean_haiku_bridge_similarity,
    -- Legacy: reconstruction scores (for old games)
    AVG(reconstruction_score) FILTER (WHERE recipient_type = 'human') as mean_human_reconstruction,
    AVG(haiku_reconstruction_score) as mean_haiku_reconstruction
FROM games_bridging
WHERE status = 'completed'
GROUP BY sender_id;

COMMENT ON VIEW user_bridging_profile IS 'Aggregated bridging game performance metrics per user (v2: bridge similarity)';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT 'Migration 003_bridging_v2.sql completed successfully' as status;
