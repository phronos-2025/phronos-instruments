-- Analytics View: User Profiles Extended
-- 
-- Provides comprehensive profile data for Jupyter notebook analysis
-- Access via service key (bypasses RLS for research)

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE OR REPLACE VIEW analytics.user_profiles_extended AS
SELECT 
    up.*,
    u.games_played,
    u.is_anonymous,
    u.created_at AS user_created_at,
    u.terms_accepted_at
FROM user_profiles up
JOIN users u ON up.user_id = u.id;

-- Grant access to service role (for Jupyter notebooks)
GRANT USAGE ON SCHEMA analytics TO service_role;
GRANT SELECT ON analytics.user_profiles_extended TO service_role;
