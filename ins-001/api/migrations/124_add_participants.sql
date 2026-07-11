-- Migration 124: Participant identity (additive half of account removal)
--
-- Additive and safe to run against production while the OLD code is still
-- deployed: the currently-running app inserts sender_id = auth.uid() (still a
-- valid UUID, just no longer FK-checked) and reads the untouched users table.
-- The participants table and participant_profiles view are new and unused by it.
--
-- The DESTRUCTIVE half (drop users, drop RLS policies, revoke anon/authenticated
-- grants, disable anonymous sign-ins) lives in a later teardown migration and
-- ships with the coordinated cutover, not here.
--
-- Column names are unchanged: games.sender_id now holds a participant UUID.

-- 1. Participant registry. One row per browser that accepts terms; games can also
--    reference participants that never created a row here (terms optional path).
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    terms_accepted_at TIMESTAMPTZ
);

COMMENT ON TABLE participants IS
    'Client-minted participant identities (replaces the users/auth.users account model).';

-- 2. Drop the foreign keys to auth.users so participant UUIDs can be written.
--    These columns keep their data; only the referential check is removed.
ALTER TABLE games              DROP CONSTRAINT IF EXISTS games_sender_id_fkey;
ALTER TABLE games              DROP CONSTRAINT IF EXISTS games_recipient_id_fkey;
ALTER TABLE study_enrollments  DROP CONSTRAINT IF EXISTS study_enrollments_user_id_fkey;
ALTER TABLE study_surveys      DROP CONSTRAINT IF EXISTS study_surveys_user_id_fkey;
ALTER TABLE study_evaluations  DROP CONSTRAINT IF EXISTS study_evaluations_user_id_fkey;

-- 3. participant_profiles: the aggregate profile keyed on games.sender_id
--    directly, with no dependency on the users/auth.users tables. Mirrors the
--    columns of the old user_profiles view so ProfileResponse is unchanged.
--    (user_profiles is left in place for the still-deployed old code.)
CREATE OR REPLACE VIEW participant_profiles AS
WITH stats AS (
    SELECT
        g.sender_id AS participant_id,
        count(g.id) AS games_played,
        avg((g.sender_scores ->> 'divergence')::double precision) AS divergence_mean,
        stddev((g.sender_scores ->> 'divergence')::double precision) AS divergence_std,
        count(*) FILTER (WHERE (g.sender_scores ->> 'divergence') IS NOT NULL) AS divergence_n,
        avg((g.recipient_scores ->> 'convergence')::double precision) FILTER (WHERE g.recipient_type = 'network') AS network_convergence_mean,
        avg((g.recipient_scores ->> 'convergence')::double precision) FILTER (WHERE g.recipient_type = 'stranger') AS stranger_convergence_mean,
        avg((g.recipient_scores ->> 'convergence')::double precision) FILTER (WHERE g.recipient_type = 'llm') AS llm_convergence_mean,
        count(*) FILTER (WHERE g.recipient_type = 'network') AS network_games,
        count(*) FILTER (WHERE g.recipient_type = 'stranger') AS stranger_games,
        count(*) FILTER (WHERE g.recipient_type = 'llm') AS llm_games,
        count(*) FILTER (WHERE g.game_type = 'radiation') AS radiation_games,
        count(*) FILTER (WHERE g.game_type = 'bridging') AS bridging_games
    FROM games g
    WHERE g.status = 'completed'
    GROUP BY g.sender_id
)
SELECT
    participant_id AS user_id,
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
    games_played >= 15 AS profile_ready,
    CASE WHEN network_convergence_mean > 0
         THEN stranger_convergence_mean / network_convergence_mean END AS semantic_portability,
    CASE WHEN divergence_mean > 0 AND divergence_std IS NOT NULL
         THEN GREATEST(0, 1 - divergence_std / divergence_mean) END AS consistency_score,
    CASE
        WHEN games_played < 15 THEN 'Emerging'
        WHEN divergence_mean >= 50 AND COALESCE(network_convergence_mean, 0) >= 0.6 AND COALESCE(stranger_convergence_mean, 0) >= 0.6 THEN 'Creative Communicator'
        WHEN divergence_mean >= 50 AND COALESCE(network_convergence_mean, 0) >= 0.6 AND COALESCE(stranger_convergence_mean, 0) <  0.6 THEN 'In-Group Creator'
        WHEN divergence_mean >= 50 AND COALESCE(network_convergence_mean, 0) <  0.6 THEN 'Idiosyncratic'
        WHEN divergence_mean <  50 AND COALESCE(network_convergence_mean, 0) >= 0.6 AND COALESCE(stranger_convergence_mean, 0) >= 0.6 THEN 'Conventional Coordinator'
        WHEN divergence_mean <  50 AND COALESCE(network_convergence_mean, 0) <  0.6 THEN 'Communication Difficulty'
        ELSE 'Emerging'
    END AS archetype
FROM stats;

SELECT 'Migration 124: participants table, FK drops, participant_profiles view' as status;
