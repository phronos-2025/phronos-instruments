-- Migration 106: Review Anonymous Access Policies
--
-- This migration documents and fixes RLS policies that allow anonymous access.
-- Some anonymous access is INTENTIONAL for the app to function.
--
-- Reference: https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins

-- ============================================
-- INTENTIONAL ANONYMOUS ACCESS (NO CHANGES NEEDED)
-- ============================================
-- These policies are designed to allow anonymous/public access:

-- 1. instruments (instruments_public_read)
--    REASON: Instrument definitions are public content, needed for landing page
--    RISK: Low - read-only, no sensitive data

-- 2. model_versions (model_versions_public_read)
--    REASON: Model version info is public metadata
--    RISK: Low - read-only, no sensitive data

-- 3. system_config (system_config_public_read)
--    REASON: System config contains public settings (no secrets)
--    RISK: Low - read-only, ensure no secrets are stored here

-- 4. share_tokens (share_tokens_public_read)
--    REASON: Needed for join flow - users access games via share links
--    RISK: Medium - tokens should be random and expire
--    MITIGATION: Tokens are UUID-based and have expiration

-- 5. vocabulary_embeddings (Authenticated users can read vocabulary)
--    NOTE: This actually requires authentication (auth.uid() IS NOT NULL)
--    REASON: Word embeddings are needed for game functionality
--    RISK: Low - scientific data, not personal info

-- ============================================
-- REQUIRES REVIEW: Anonymous access to user tables
-- ============================================

-- 6. public.games (games_recipient_select, games_recipient_update, games_sender)
--    ISSUE: Anonymous users can play games (by design for frictionless UX)
--    REASON: App supports anonymous play before account creation
--    RISK: Medium - anonymous users can create/view games
--    RECOMMENDATION: This is intentional for the app's UX model

-- 7. public.users (Users can read own data, Users can update own data)
--    ISSUE: Policies use auth.uid() which works for anonymous users
--    REASON: Anonymous users have auth records in Supabase
--    RISK: Low - users can only access their own data

-- 8. public.social_edges (edges_participant)
--    ISSUE: Anonymous users can view edges they participate in
--    REASON: Game relationships should be visible to participants
--    RISK: Low - limited to own participation

-- ============================================
-- FIX: mailing_list policies (already fixed in 103)
-- ============================================

-- 9. public.mailing_list (mailing_list_own_select, mailing_list_own_update)
--    STATUS: Fixed in migration 103
--    These policies now properly restrict to authenticated users only
--    for SELECT and UPDATE operations.

-- ============================================
-- EXTERNAL SCHEMAS (Cannot modify)
-- ============================================

-- auth.users - Managed by Supabase Auth, do not modify
-- cron.job / cron.job_run_details - Managed by pg_cron extension

-- ============================================
-- OPTIONAL: Restrict games to authenticated users only
-- ============================================
-- If you want to REQUIRE authentication for playing games,
-- uncomment the following:

/*
-- Remove existing policies that allow anonymous access
DROP POLICY IF EXISTS games_sender ON public.games;
DROP POLICY IF EXISTS games_recipient ON public.games;
DROP POLICY IF EXISTS games_recipient_select ON public.games;
DROP POLICY IF EXISTS games_recipient_update ON public.games;

-- Create new policies that require non-anonymous authentication
CREATE POLICY games_sender_authenticated ON public.games
    FOR ALL
    USING (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND is_anonymous = FALSE
        )
    );

CREATE POLICY games_recipient_select_authenticated ON public.games
    FOR SELECT
    USING (
        recipient_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND is_anonymous = FALSE
        )
    );

CREATE POLICY games_recipient_update_authenticated ON public.games
    FOR UPDATE
    USING (
        recipient_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND is_anonymous = FALSE
        )
    );
*/

-- ============================================
-- SECURITY DOCUMENTATION
-- ============================================

COMMENT ON TABLE public.games IS 'Game records. Anonymous access intentionally allowed for frictionless UX.';
COMMENT ON TABLE public.instruments IS 'Instrument definitions. Public read access intentional.';
COMMENT ON TABLE public.share_tokens IS 'Game share tokens. Public read required for join flow. Tokens are UUID-based with expiration.';
COMMENT ON TABLE public.system_config IS 'System configuration. Public read intentional. DO NOT store secrets here.';
COMMENT ON TABLE public.vocabulary_embeddings IS 'Word embeddings for semantic similarity. Authenticated read access.';

SELECT 'Migration 106: Anonymous access policies reviewed and documented' as status;
