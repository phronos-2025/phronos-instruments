-- Migration 100f: Join Game Function
-- Run AFTER 100e

-- Join game via share token
CREATE OR REPLACE FUNCTION join_game_via_token(share_token_input TEXT)
RETURNS TABLE(
    game_id UUID,
    game_type TEXT,
    setup JSONB,
    sender_input JSONB,
    sender_display_name TEXT
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_game_id UUID;
    v_recipient_id UUID;
    v_game_status TEXT;
    v_game_sender_id UUID;
BEGIN
    v_recipient_id := auth.uid();

    IF v_recipient_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock token row to prevent race condition
    SELECT st.game_id INTO v_game_id
    FROM share_tokens st
    WHERE st.token = share_token_input
      AND st.is_active = TRUE
      AND st.expires_at > NOW()
    FOR UPDATE;

    IF v_game_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired share token';
    END IF;

    -- Get game details
    SELECT g.status, g.sender_id
    INTO v_game_status, v_game_sender_id
    FROM games g
    WHERE g.id = v_game_id;

    -- Prevent self-play
    IF v_game_sender_id = v_recipient_id THEN
        RAISE EXCEPTION 'You cannot join your own game';
    END IF;

    -- Check game state
    IF v_game_status = 'pending_clues' THEN
        RAISE EXCEPTION 'The sender has not finished writing clues yet';
    END IF;

    IF v_game_status != 'pending_guess' THEN
        RAISE EXCEPTION 'This game is no longer available';
    END IF;

    -- Check if already has recipient
    IF EXISTS (SELECT 1 FROM games WHERE id = v_game_id AND recipient_id IS NOT NULL) THEN
        RAISE EXCEPTION 'This game already has a recipient';
    END IF;

    -- Assign recipient
    UPDATE games SET recipient_id = v_recipient_id WHERE id = v_game_id;

    -- Deactivate token
    UPDATE share_tokens SET is_active = FALSE WHERE token = share_token_input;

    -- Return game details (setup does NOT include seed_word for radiation games - security)
    RETURN QUERY
    SELECT
        g.id,
        g.game_type,
        CASE
            WHEN g.game_type = 'radiation' THEN
                jsonb_build_object('noise_floor', g.setup->'noise_floor')
            ELSE
                g.setup
        END,
        g.sender_input,
        u.display_name
    FROM games g
    JOIN users u ON g.sender_id = u.id
    WHERE g.id = v_game_id;
END;
$$ LANGUAGE plpgsql;

SELECT 'Phase 100f: Join function created' as status;
