-- Migration 107: Fix RLS Performance Issues
--
-- PERFORMANCE ISSUES:
-- 1. auth_rls_initplan: auth.uid() and current_setting() re-evaluated per row
--    FIX: Wrap in (SELECT ...) to evaluate once per query
--
-- 2. multiple_permissive_policies: Multiple policies for same role/action
--    FIX: Combine into single policy with OR conditions
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

-- ============================================
-- 1. FIX: public.users policies
-- ============================================

DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;

CREATE POLICY "Users can read own data" ON public.users
    FOR SELECT
    USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE
    USING (id = (SELECT auth.uid()));

-- ============================================
-- 2. FIX: public.vocabulary_embeddings policy
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can read vocabulary" ON public.vocabulary_embeddings;

CREATE POLICY "Authenticated users can read vocabulary" ON public.vocabulary_embeddings
    FOR SELECT
    USING ((SELECT auth.uid()) IS NOT NULL);

-- ============================================
-- 3. FIX: public.games policies (combine + optimize)
-- ============================================

-- Drop existing separate policies
DROP POLICY IF EXISTS games_sender ON public.games;
DROP POLICY IF EXISTS games_recipient ON public.games;
DROP POLICY IF EXISTS games_recipient_select ON public.games;
DROP POLICY IF EXISTS games_recipient_update ON public.games;

-- Combined SELECT policy (sender OR recipient can view)
CREATE POLICY games_select ON public.games
    FOR SELECT
    USING (
        sender_id = (SELECT auth.uid())
        OR recipient_id = (SELECT auth.uid())
    );

-- Sender can INSERT
CREATE POLICY games_insert ON public.games
    FOR INSERT
    WITH CHECK (sender_id = (SELECT auth.uid()));

-- Combined UPDATE policy (sender OR recipient can update)
CREATE POLICY games_update ON public.games
    FOR UPDATE
    USING (
        sender_id = (SELECT auth.uid())
        OR recipient_id = (SELECT auth.uid())
    );

-- Sender can DELETE
CREATE POLICY games_delete ON public.games
    FOR DELETE
    USING (sender_id = (SELECT auth.uid()));

-- ============================================
-- 4. FIX: public.share_tokens policy
-- ============================================

DROP POLICY IF EXISTS share_tokens_sender_insert ON public.share_tokens;

CREATE POLICY share_tokens_sender_insert ON public.share_tokens
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.games
            WHERE id = game_id
            AND sender_id = (SELECT auth.uid())
        )
    );

-- ============================================
-- 5. FIX: public.social_edges policy
-- ============================================

DROP POLICY IF EXISTS edges_participant ON public.social_edges;

CREATE POLICY edges_participant ON public.social_edges
    FOR SELECT
    USING (
        from_user_id = (SELECT auth.uid())
        OR to_user_id = (SELECT auth.uid())
    );

-- ============================================
-- 6. FIX: public.mailing_list policies
-- ============================================

DROP POLICY IF EXISTS mailing_list_auth_insert ON public.mailing_list;
DROP POLICY IF EXISTS mailing_list_own_select ON public.mailing_list;
DROP POLICY IF EXISTS mailing_list_own_update ON public.mailing_list;

-- Authenticated INSERT
CREATE POLICY mailing_list_auth_insert ON public.mailing_list
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (user_id IS NULL OR user_id = (SELECT auth.uid()))
        AND (source IS NULL OR source IN ('website', 'landing', 'instrument', 'app'))
    );

-- SELECT own subscription
CREATE POLICY mailing_list_own_select ON public.mailing_list
    FOR SELECT
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR email = (SELECT current_setting('request.jwt.claims', true)::json->>'email')
    );

-- UPDATE own subscription
CREATE POLICY mailing_list_own_update ON public.mailing_list
    FOR UPDATE
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR email = (SELECT current_setting('request.jwt.claims', true)::json->>'email')
    )
    WITH CHECK (
        user_id IS NULL OR user_id = (SELECT auth.uid())
    );

SELECT 'Migration 107: RLS performance optimizations applied' as status;
