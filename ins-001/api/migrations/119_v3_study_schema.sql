-- Migration 119: v3 Study Schema Extensions
-- Adds evaluative task support, peer ratings, and optional break tracking

BEGIN;

-- 1a. Extend study_enrollments for v3
ALTER TABLE study_enrollments
  ADD COLUMN IF NOT EXISTS items_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opted_partial BOOLEAN DEFAULT NULL;

-- 1b. Extend games table with timing columns
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS time_to_complete_ms INTEGER,
  ADD COLUMN IF NOT EXISTS inter_item_interval_ms INTEGER;

-- 1c. Create study_evaluations table (items 5, 6, 7)
CREATE TABLE IF NOT EXISTS study_evaluations (
  id SERIAL PRIMARY KEY,
  study_slug TEXT NOT NULL REFERENCES studies(slug),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  item_number INTEGER NOT NULL,
  task TEXT NOT NULL CHECK (task IN ('alignment_ranking', 'parsimony_loo', 'peer_rating')),
  stimulus JSONB NOT NULL,
  response JSONB NOT NULL,
  feedback JSONB,
  time_to_complete_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(study_slug, user_id, item_number)
);

-- 1d. Create peer_ratings table (item 7 detail rows)
CREATE TABLE IF NOT EXISTS peer_ratings (
  id SERIAL PRIMARY KEY,
  evaluation_id INTEGER NOT NULL REFERENCES study_evaluations(id),
  rated_game_id UUID REFERENCES games(id),
  response_index INTEGER NOT NULL,
  difference INTEGER CHECK (difference BETWEEN 1 AND 5),
  connection INTEGER CHECK (connection BETWEEN 1 AND 5),
  uniqueness INTEGER CHECK (uniqueness BETWEEN 1 AND 5),
  is_preconstructed BOOLEAN DEFAULT false
);

-- 1e. Indexes
CREATE INDEX IF NOT EXISTS idx_evaluations_study_user ON study_evaluations(study_slug, user_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_study_item ON study_evaluations(study_slug, item_number);
CREATE INDEX IF NOT EXISTS idx_peer_ratings_evaluation ON peer_ratings(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_peer_ratings_game ON peer_ratings(rated_game_id) WHERE rated_game_id IS NOT NULL;

-- 1f. RLS policies for study_evaluations
ALTER TABLE study_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY evaluations_select ON study_evaluations
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY evaluations_insert ON study_evaluations
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY evaluations_update ON study_evaluations
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- RLS for peer_ratings (via evaluation ownership)
ALTER TABLE peer_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY peer_ratings_select ON peer_ratings
  FOR SELECT USING (
    evaluation_id IN (SELECT id FROM study_evaluations WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY peer_ratings_insert ON peer_ratings
  FOR INSERT WITH CHECK (
    evaluation_id IN (SELECT id FROM study_evaluations WHERE user_id = (SELECT auth.uid()))
  );

COMMIT;
