-- Migration 117: Studies & Peer Comparison Dashboard
-- Creates tables for curated game batteries and extends games table with study context.

BEGIN;

-- ============================================
-- NEW TABLE: studies
-- Curated batteries of INS-001 tasks with cohort boundaries.
-- ============================================

CREATE TABLE IF NOT EXISTS studies (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  worked_example JSONB,
  pre_survey JSONB,
  post_survey JSONB,
  is_active BOOLEAN DEFAULT true,
  require_auth BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- NEW TABLE: study_enrollments
-- Tracks participant progress through a study battery.
-- ============================================

CREATE TABLE IF NOT EXISTS study_enrollments (
  id SERIAL PRIMARY KEY,
  study_slug TEXT NOT NULL REFERENCES studies(slug) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  consented_at TIMESTAMPTZ,
  games_completed INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  UNIQUE(study_slug, user_id)
);

-- ============================================
-- NEW TABLE: study_surveys
-- Pre and post questionnaire responses.
-- ============================================

CREATE TABLE IF NOT EXISTS study_surveys (
  id SERIAL PRIMARY KEY,
  study_slug TEXT NOT NULL REFERENCES studies(slug) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timing TEXT NOT NULL CHECK (timing IN ('pre', 'post')),
  responses JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(study_slug, user_id, timing)
);

-- ============================================
-- EXTEND: games table
-- Add study context columns (nullable for non-study games).
-- ============================================

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS study_slug TEXT,
  ADD COLUMN IF NOT EXISTS game_number INTEGER,
  ADD COLUMN IF NOT EXISTS auto_submitted BOOLEAN DEFAULT false;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_games_study ON games(study_slug) WHERE study_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_study_game ON games(study_slug, game_number) WHERE study_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_study ON study_enrollments(study_slug);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON study_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_surveys_study ON study_surveys(study_slug);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_surveys ENABLE ROW LEVEL SECURITY;

-- Studies: anyone can read active studies
CREATE POLICY "studies_read_active" ON studies
  FOR SELECT USING (is_active = true);

-- Enrollments: users can read and insert their own
CREATE POLICY "enrollments_read_own" ON study_enrollments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "enrollments_insert_own" ON study_enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "enrollments_update_own" ON study_enrollments
  FOR UPDATE USING (auth.uid() = user_id);

-- Surveys: users can read and insert their own
CREATE POLICY "surveys_read_own" ON study_surveys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "surveys_insert_own" ON study_surveys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMIT;
