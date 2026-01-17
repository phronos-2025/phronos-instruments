-- Migration 102b: Force user_profiles view to SECURITY INVOKER
--
-- If the linter still shows SECURITY DEFINER after migration 102,
-- this explicitly sets the security option.

-- Check current view definition:
-- SELECT definition FROM pg_views WHERE viewname = 'user_profiles';

-- For views, the security context is controlled by the view owner and
-- security_barrier option, not SECURITY DEFINER (which is for functions).
--
-- However, Supabase may have created the view with special properties.
-- Let's drop and recreate with explicit settings.

DROP VIEW IF EXISTS analytics.user_profiles_extended;
DROP VIEW IF EXISTS public.user_profiles;

-- Recreate with explicit security settings
CREATE VIEW public.user_profiles
WITH (security_invoker = true)  -- Explicitly set security invoker
AS
WITH stats AS (
    SELECT
        u.id as user_id,
        u.display_name,
        u.is_anonymous,
        u.created_at as user_created_at,
        COUNT(g.id) as games_played,
        AVG((g.sender_scores->>'divergence')::FLOAT) as divergence_mean,
        STDDEV((g.sender_scores->>'divergence')::FLOAT) as divergence_std,
        COUNT(*) FILTER (WHERE g.sender_scores->>'divergence' IS NOT NULL) as divergence_n,
        AVG((g.recipient_scores->>'convergence')::FLOAT)
            FILTER (WHERE g.recipient_type = 'network') as network_convergence_mean,
        AVG((g.recipient_scores->>'convergence')::FLOAT)
            FILTER (WHERE g.recipient_type = 'stranger') as stranger_convergence_mean,
        AVG((g.recipient_scores->>'convergence')::FLOAT)
            FILTER (WHERE g.recipient_type = 'llm') as llm_convergence_mean,
        COUNT(*) FILTER (WHERE g.recipient_type = 'network') as network_games,
        COUNT(*) FILTER (WHERE g.recipient_type = 'stranger') as stranger_games,
        COUNT(*) FILTER (WHERE g.recipient_type = 'llm') as llm_games,
        COUNT(*) FILTER (WHERE g.game_type = 'radiation') as radiation_games,
        COUNT(*) FILTER (WHERE g.game_type = 'bridging') as bridging_games
    FROM users u
    LEFT JOIN games g ON u.id = g.sender_id AND g.status = 'completed'
    GROUP BY u.id, u.display_name, u.is_anonymous, u.created_at
)
SELECT
    user_id,
    display_name,
    is_anonymous,
    user_created_at,
    games_played,
    divergence_mean,
    divergence_std,
    divergence_n,
    network_convergence_mean,
    stranger_convergence_mean,
    llm_convergence_mean,
    network_games,
    stranger_games,
    llm_games,
    radiation_games,
    bridging_games,
    games_played >= 15 as profile_ready,
    CASE WHEN network_convergence_mean > 0 THEN
        stranger_convergence_mean / network_convergence_mean
    END as semantic_portability,
    CASE WHEN divergence_mean > 0 AND divergence_std IS NOT NULL THEN
        GREATEST(0, 1 - (divergence_std / divergence_mean))
    END as consistency_score,
    CASE
        WHEN games_played < 15 THEN 'Emerging'
        WHEN divergence_mean >= 50 AND COALESCE(network_convergence_mean, 0) >= 0.6
            AND COALESCE(stranger_convergence_mean, 0) >= 0.6
            THEN 'Creative Communicator'
        WHEN divergence_mean >= 50 AND COALESCE(network_convergence_mean, 0) >= 0.6
            AND COALESCE(stranger_convergence_mean, 0) < 0.6
            THEN 'In-Group Creator'
        WHEN divergence_mean >= 50 AND COALESCE(network_convergence_mean, 0) < 0.6
            THEN 'Idiosyncratic'
        WHEN divergence_mean < 50 AND COALESCE(network_convergence_mean, 0) >= 0.6
            AND COALESCE(stranger_convergence_mean, 0) >= 0.6
            THEN 'Conventional Coordinator'
        WHEN divergence_mean < 50 AND COALESCE(network_convergence_mean, 0) < 0.6
            THEN 'Communication Difficulty'
        ELSE 'Emerging'
    END as archetype
FROM stats;

COMMENT ON VIEW public.user_profiles IS 'Computed user profile aggregates - SECURITY INVOKER enabled';

-- Grant permissions
GRANT SELECT ON public.user_profiles TO authenticated;

-- Recreate the analytics view
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE VIEW analytics.user_profiles_extended AS
SELECT
    up.*,
    u.terms_accepted_at
FROM public.user_profiles up
JOIN public.users u ON up.user_id = u.id;

GRANT USAGE ON SCHEMA analytics TO service_role;
GRANT SELECT ON analytics.user_profiles_extended TO service_role;

-- Verify the setting
SELECT
    schemaname,
    viewname,
    viewowner
FROM pg_views
WHERE viewname = 'user_profiles';

SELECT 'Migration 102b: user_profiles view recreated with explicit security_invoker = true' as status;
