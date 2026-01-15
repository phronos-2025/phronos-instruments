-- Migration 100a: Cleanup Old Schema
-- Run this FIRST before 100b

-- Drop views first (dependencies)
DROP VIEW IF EXISTS user_bridging_profile CASCADE;

-- Drop cron jobs (ignore errors if they don't exist)
DO $$
BEGIN
    PERFORM cron.unschedule('expire-games');
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'expire-games cron job not found, skipping';
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('cleanup-anon-users');
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'cleanup-anon-users cron job not found, skipping';
END $$;

-- Drop old functions
DROP FUNCTION IF EXISTS get_noise_floor(TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS get_noise_floor_by_embedding(halfvec, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS get_distant_words(halfvec, INT) CASCADE;
DROP FUNCTION IF EXISTS get_distant_words(vector, INT) CASCADE;
DROP FUNCTION IF EXISTS get_nearest_word_excluding(halfvec, TEXT[], INT) CASCADE;
DROP FUNCTION IF EXISTS get_statistical_union(TEXT, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS join_game_via_token(TEXT) CASCADE;
DROP FUNCTION IF EXISTS join_bridging_game_via_code(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS generate_bridging_share_code() CASCADE;
DROP FUNCTION IF EXISTS recreate_vocabulary_index() CASCADE;

-- Drop triggers (but keep the function for now)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop tables in dependency order
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS share_tokens CASCADE;
DROP TABLE IF EXISTS games_bridging CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS social_edges CASCADE;

SELECT 'Phase 100a: Cleanup complete' as status;
