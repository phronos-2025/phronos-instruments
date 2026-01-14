-- Migration: Add binding_score and lexical_similarity columns to games_bridging
-- Binding score measures how well clues jointly relate to BOTH anchor and target
-- Lexical similarity measures how similar user's clues are to the statistical lexical union

-- Add binding scores for sender, recipient, and Haiku
ALTER TABLE games_bridging
ADD COLUMN IF NOT EXISTS binding_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS recipient_binding NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS haiku_binding NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS lexical_similarity NUMERIC(5,2);

-- Add comments
COMMENT ON COLUMN games_bridging.binding_score IS 'How well sender clues relate to both endpoints (0-100 scale)';
COMMENT ON COLUMN games_bridging.recipient_binding IS 'How well recipient clues relate to both endpoints (0-100 scale)';
COMMENT ON COLUMN games_bridging.haiku_binding IS 'How well Haiku clues relate to both endpoints (0-100 scale)';
COMMENT ON COLUMN games_bridging.lexical_similarity IS 'Similarity between user clues and lexical union (0-100 scale)';
