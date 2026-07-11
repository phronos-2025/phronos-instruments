-- Migration 126: Retire the pg_cron jobs
--
-- Both jobs are obsolete under the new architecture:
--   expire-games       — expired pending games mattered for two-player invites;
--                        with multiplayer gone the solo LLM flow completes inline.
--   cleanup-anon-users — deleted stale anonymous auth.users rows; there are no
--                        anonymous accounts any more (participant identity is
--                        client-side, no auth.users row).
--
-- Driving keep-alive/expiry from pg_cron is also the wrong place once the project
-- is on Free (in-database cron stops entirely when the project pauses). Any future
-- keep-alive should be an external ping.
--
-- Unscheduling also stops cron.job_run_details from growing unbounded.

SELECT cron.unschedule('expire-games');
SELECT cron.unschedule('cleanup-anon-users');

SELECT 'Migration 126: pg_cron jobs expire-games and cleanup-anon-users unscheduled' as status;
