-- Migration 100i: Cron Jobs
-- Run AFTER 100h

-- Expire old games (hourly)
SELECT cron.schedule('expire-games', '0 * * * *', $$
    UPDATE games SET status = 'expired'
    WHERE status IN ('pending_clues', 'pending_guess')
    AND expires_at < NOW()
$$);

-- Clean up anonymous users (daily at 3am)
SELECT cron.schedule('cleanup-anon-users', '0 3 * * *', $$
    DELETE FROM auth.users
    WHERE id IN (
        SELECT u.id FROM users u
        WHERE u.is_anonymous = true
        AND u.created_at < NOW() - INTERVAL '30 days'
        AND u.id NOT IN (
            SELECT DISTINCT sender_id FROM games WHERE sender_id IS NOT NULL
            UNION
            SELECT DISTINCT recipient_id FROM games WHERE recipient_id IS NOT NULL
        )
    )
$$);

SELECT 'Phase 100i: Cron jobs scheduled' as status;
