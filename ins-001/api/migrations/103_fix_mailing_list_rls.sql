-- Migration 103: Fix mailing_list RLS policies
--
-- SECURITY ISSUES ADDRESSED:
-- 1. mailing_list_public_insert: WITH CHECK (true) allows anyone to insert any data
-- 2. mailing_list_token_select: USING (true) allows anyone to read ALL subscriptions
--
-- These policies effectively bypass RLS and expose sensitive data.

-- ============================================
-- DROP EXISTING OVERLY-PERMISSIVE POLICIES
-- ============================================

DROP POLICY IF EXISTS mailing_list_public_insert ON mailing_list;
DROP POLICY IF EXISTS mailing_list_token_select ON mailing_list;
DROP POLICY IF EXISTS mailing_list_user_select ON mailing_list;
DROP POLICY IF EXISTS mailing_list_user_update ON mailing_list;
-- Also drop the new policies in case of re-run
DROP POLICY IF EXISTS mailing_list_anon_insert ON mailing_list;
DROP POLICY IF EXISTS mailing_list_auth_insert ON mailing_list;
DROP POLICY IF EXISTS mailing_list_own_select ON mailing_list;
DROP POLICY IF EXISTS mailing_list_own_update ON mailing_list;

-- ============================================
-- CREATE SECURE POLICIES
-- ============================================

-- 1. Public INSERT: Allow inserts but restrict what can be inserted
-- Users can only set their own email, cannot set user_id or other sensitive fields
CREATE POLICY mailing_list_anon_insert ON mailing_list
    FOR INSERT
    TO anon
    WITH CHECK (
        -- Anon users can only insert with null user_id
        user_id IS NULL
        -- Source must be a valid public source
        AND (source IS NULL OR source IN ('website', 'landing'))
    );

-- Authenticated users can subscribe themselves
CREATE POLICY mailing_list_auth_insert ON mailing_list
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Must use their own user_id or null
        (user_id IS NULL OR user_id = auth.uid())
        -- Source must be valid
        AND (source IS NULL OR source IN ('website', 'landing', 'instrument', 'app'))
    );

-- 2. SELECT: Users can only view their own subscription
-- Removed the overly-permissive token_select policy
CREATE POLICY mailing_list_own_select ON mailing_list
    FOR SELECT
    TO authenticated
    USING (
        -- Match by user_id
        user_id = auth.uid()
        -- OR match by email from JWT claims
        OR email = (current_setting('request.jwt.claims', true)::json->>'email')
    );

-- 3. SELECT by unsubscribe token: Use a SECURITY DEFINER function instead
-- This is safer than allowing public SELECT on the entire table
-- See function below

-- 4. UPDATE: Users can only update their own subscription
CREATE POLICY mailing_list_own_update ON mailing_list
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR email = (current_setting('request.jwt.claims', true)::json->>'email')
    )
    WITH CHECK (
        -- Cannot change user_id to someone else's
        (user_id IS NULL OR user_id = auth.uid())
    );

-- ============================================
-- SECURE UNSUBSCRIBE FUNCTION
-- ============================================
-- Instead of allowing public SELECT on all rows, use a function
-- that only returns/modifies the row matching the token

CREATE OR REPLACE FUNCTION unsubscribe_by_token(p_token TEXT)
RETURNS TABLE (
    email TEXT,
    is_active BOOLEAN
) AS $$
BEGIN
    -- Update and return the affected row
    RETURN QUERY
    UPDATE mailing_list
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE unsubscribe_token = p_token
      AND is_active = TRUE
    RETURNING mailing_list.email, mailing_list.is_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon (for unsubscribe links in emails)
GRANT EXECUTE ON FUNCTION unsubscribe_by_token(TEXT) TO anon, authenticated;

-- Function to check subscription status by token (read-only, for confirmation page)
CREATE OR REPLACE FUNCTION get_subscription_by_token(p_token TEXT)
RETURNS TABLE (
    email TEXT,
    is_active BOOLEAN,
    subscribed_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.email,
        m.is_active,
        m.subscribed_at
    FROM mailing_list m
    WHERE m.unsubscribe_token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_subscription_by_token(TEXT) TO anon, authenticated;

-- ============================================
-- RATE LIMITING NOTE
-- ============================================
-- Consider adding rate limiting at the application layer (API) for:
-- - Subscription inserts (prevent spam signups)
-- - Token lookups (prevent enumeration attacks)
--
-- Supabase doesn't have built-in rate limiting for RLS policies,
-- so this should be handled in your FastAPI backend.

SELECT 'Migration 103: mailing_list RLS policies secured' as status;
