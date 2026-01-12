-- Cleanup Script: Drop all INS-001 tables and functions
-- Run this BEFORE running 001_initial_fallback.sql if tables already exist
-- 
-- WARNING: This will delete all data! Only run on a fresh/empty database.

-- Drop in reverse dependency order
DROP TABLE IF EXISTS social_edges CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS share_tokens CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS vocabulary_embeddings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS sync_user_anonymous_status() CASCADE;
DROP FUNCTION IF EXISTS get_noise_floor_by_embedding(vector, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS join_game_via_token(TEXT) CASCADE;
DROP FUNCTION IF EXISTS recreate_vocabulary_index() CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Note: Extensions (vector, pg_cron) are left intact - no need to drop them
