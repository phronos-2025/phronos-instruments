-- Migration 127: Close anon exposure on the new participant objects
--
-- The backend uses only the service key (which bypasses RLS), and the public anon
-- key is no longer used by the frontend at all. But three objects created during
-- the account migration were left reachable by the public anon key over PostgREST:
--
--   1. participants — created in 124 with NO RLS. Supabase default-grants anon
--      full DML on new public tables, so with RLS off the anon key could read AND
--      DELETE the table. (TRUNCATE is granted too but PostgREST can't invoke it.)
--   2. participant_profiles — a SECURITY DEFINER view (the default), so it runs as
--      owner and bypasses the games RLS, leaking per-participant aggregates to anon.
--   3. share_tokens — still carried public read/insert policies from the removed
--      multiplayer feature.
--
-- Fixes below deny the anon/authenticated roles; the service key is unaffected, so
-- the running API keeps working.

-- 1. participants: RLS on with no policy = deny-all to anon/authenticated.
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.participants FROM anon, authenticated;

-- 2. participant_profiles: respect the caller's RLS (anon then sees 0 games), and
--    drop the anon/authenticated grants for good measure. service_role still reads
--    everything (BYPASSRLS), so /users/me/profile is unaffected.
ALTER VIEW public.participant_profiles SET (security_invoker = true);
REVOKE ALL ON public.participant_profiles FROM anon, authenticated;

-- 3. share_tokens: remove the obsolete public policies (feature removed). RLS stays
--    enabled with no policy => deny-all.
DROP POLICY IF EXISTS share_tokens_public_read ON public.share_tokens;
DROP POLICY IF EXISTS share_tokens_sender_insert ON public.share_tokens;

SELECT 'Migration 127: participants RLS, participant_profiles security_invoker, share_tokens locked down' as status;
