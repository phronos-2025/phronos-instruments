-- Migration 108: Fix mailing list subscribe functionality
--
-- The RLS policies in migration 103 broke the subscribe flow because:
-- 1. Anon users can't SELECT to check if email exists
-- 2. Anon users can't UPDATE to reactivate subscriptions
--
-- FIX: Create a SECURITY DEFINER function that handles the entire
-- subscribe flow, similar to how we handle unsubscribe.

-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.subscribe_to_mailing_list(TEXT, TEXT, UUID);

-- Create secure subscribe function
CREATE OR REPLACE FUNCTION public.subscribe_to_mailing_list(
    p_email TEXT,
    p_source TEXT DEFAULT 'website',
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    email TEXT,
    unsubscribe_token TEXT,
    is_active BOOLEAN,
    already_subscribed BOOLEAN,
    was_reactivated BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_existing RECORD;
    v_new_id UUID;
    v_token TEXT;
BEGIN
    -- Validate source
    IF p_source IS NOT NULL AND p_source NOT IN ('website', 'landing', 'instrument', 'app') THEN
        p_source := 'website';
    END IF;

    -- Check for existing subscription
    SELECT
        m.id,
        m.email,
        m.unsubscribe_token,
        m.is_active,
        m.user_id
    INTO v_existing
    FROM public.mailing_list m
    WHERE m.email = lower(p_email);

    IF v_existing.id IS NOT NULL THEN
        -- Existing subscription found
        IF v_existing.is_active THEN
            -- Already subscribed and active
            RETURN QUERY SELECT
                v_existing.id,
                v_existing.email,
                v_existing.unsubscribe_token,
                TRUE::BOOLEAN,
                TRUE::BOOLEAN,   -- already_subscribed
                FALSE::BOOLEAN;  -- was_reactivated
        ELSE
            -- Reactivate subscription
            UPDATE public.mailing_list
            SET
                is_active = TRUE,
                updated_at = NOW(),
                user_id = COALESCE(public.mailing_list.user_id, p_user_id)
            WHERE public.mailing_list.id = v_existing.id;

            RETURN QUERY SELECT
                v_existing.id,
                v_existing.email,
                v_existing.unsubscribe_token,
                TRUE::BOOLEAN,
                FALSE::BOOLEAN,  -- already_subscribed
                TRUE::BOOLEAN;   -- was_reactivated
        END IF;
    ELSE
        -- New subscription
        INSERT INTO public.mailing_list (email, source, user_id)
        VALUES (lower(p_email), p_source, p_user_id)
        RETURNING
            public.mailing_list.id,
            public.mailing_list.unsubscribe_token
        INTO v_new_id, v_token;

        RETURN QUERY SELECT
            v_new_id,
            lower(p_email),
            v_token,
            TRUE::BOOLEAN,
            FALSE::BOOLEAN,  -- already_subscribed
            FALSE::BOOLEAN;  -- was_reactivated
    END IF;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.subscribe_to_mailing_list(TEXT, TEXT, UUID) TO anon, authenticated;

-- Also add a policy for anon SELECT by email (limited - only returns if email matches)
-- This is needed if the API still does direct queries
DROP POLICY IF EXISTS mailing_list_anon_select_by_email ON public.mailing_list;

CREATE POLICY mailing_list_anon_select_by_email ON public.mailing_list
    FOR SELECT
    TO anon
    USING (
        -- Anon can only select if they're checking their own email
        -- This is somewhat permissive but email is provided by the user
        TRUE
    );

-- Wait, that's too permissive. Let's not add that policy.
-- Instead, the API should use the subscribe_to_mailing_list function.

DROP POLICY IF EXISTS mailing_list_anon_select_by_email ON public.mailing_list;

SELECT 'Migration 108: subscribe_to_mailing_list function created' as status;
