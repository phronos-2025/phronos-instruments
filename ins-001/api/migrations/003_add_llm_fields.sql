-- Migration: Add LLM baseline fields and sharing_skipped flag
-- Date: 2026-01-13
-- Description: Support share-first flow where LLM always guesses for baseline analytics

-- Add LLM-specific fields (separate from human recipient fields)
ALTER TABLE games
ADD COLUMN IF NOT EXISTS llm_guesses JSONB,
ADD COLUMN IF NOT EXISTS llm_convergence_score FLOAT,
ADD COLUMN IF NOT EXISTS llm_guess_similarities JSONB;

-- Add sharing_skipped flag to track when user skips sharing
ALTER TABLE games
ADD COLUMN IF NOT EXISTS sharing_skipped BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN games.llm_guesses IS 'LLM guesses (always populated for baseline analytics)';
COMMENT ON COLUMN games.llm_convergence_score IS 'LLM convergence score (always populated)';
COMMENT ON COLUMN games.llm_guess_similarities IS 'Per-guess similarity scores for LLM';
COMMENT ON COLUMN games.sharing_skipped IS 'True if user skipped sharing and went straight to results';
