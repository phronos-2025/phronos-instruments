-- Migration: Add binding_score columns to games_bridging
-- Binding score measures how well clues jointly relate to BOTH anchor and target

-- Add binding scores for sender, recipient, and Haiku
ALTER TABLE games_bridging
ADD COLUMN IF NOT EXISTS binding_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS recipient_binding NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS haiku_binding NUMERIC(5,2);

-- Add comments
COMMENT ON COLUMN games_bridging.binding_score IS 'How well sender clues relate to both endpoints (0-100 scale)';
COMMENT ON COLUMN games_bridging.recipient_binding IS 'How well recipient clues relate to both endpoints (0-100 scale)';
COMMENT ON COLUMN games_bridging.haiku_binding IS 'How well Haiku clues relate to both endpoints (0-100 scale)';
