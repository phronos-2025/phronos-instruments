-- Migration: Add V3 unified scoring columns to games_bridging
-- V3 scoring uses:
--   - relevance: min(sim_anchor, sim_target) per clue, then mean (0-1 scale)
--   - relevance_percentile: percentile vs random baseline (0-100)
--   - divergence: DAT-style spread score (0-100)
-- Plus lexical union baseline scores

-- Add V3 scoring columns for sender
ALTER TABLE games_bridging
ADD COLUMN IF NOT EXISTS relevance NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS relevance_percentile NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS divergence NUMERIC(5,2);

-- Add V3 scoring for lexical union baseline
ALTER TABLE games_bridging
ADD COLUMN IF NOT EXISTS lexical_relevance NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS lexical_divergence NUMERIC(5,2);

-- Add V3 scoring for Haiku
ALTER TABLE games_bridging
ADD COLUMN IF NOT EXISTS haiku_relevance NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS haiku_divergence NUMERIC(5,2);

-- Add V3 scoring for recipient
ALTER TABLE games_bridging
ADD COLUMN IF NOT EXISTS recipient_relevance NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS recipient_divergence NUMERIC(5,2);

-- Add comments for documentation
COMMENT ON COLUMN games_bridging.relevance IS 'V3: mean of min(sim_anchor, sim_target) per clue (0-1 scale)';
COMMENT ON COLUMN games_bridging.relevance_percentile IS 'V3: percentile vs random baseline (0-100)';
COMMENT ON COLUMN games_bridging.divergence IS 'V3: DAT-style spread score (0-100)';
COMMENT ON COLUMN games_bridging.lexical_relevance IS 'V3: lexical union relevance (0-1 scale)';
COMMENT ON COLUMN games_bridging.lexical_divergence IS 'V3: lexical union spread (0-100)';
COMMENT ON COLUMN games_bridging.haiku_relevance IS 'V3: Haiku union relevance (0-1 scale)';
COMMENT ON COLUMN games_bridging.haiku_divergence IS 'V3: Haiku union spread (0-100)';
COMMENT ON COLUMN games_bridging.recipient_relevance IS 'V3: recipient union relevance (0-1 scale)';
COMMENT ON COLUMN games_bridging.recipient_divergence IS 'V3: recipient union spread (0-100)';
