-- Migration 123: Add sender_scores_v2 for exact-search rescoring
--
-- Context: vector search moved from an approximate ivfflat index to exact
-- in-process cosine search (see docs/DECISION-HISTORY.md §2). Exact retrieval
-- changes the noise floor, which changes divergence by a median of ~0.021
-- (~8% of a typical score).
--
-- `sender_scores` is preserved verbatim as the historical record: those values
-- were produced by whatever the ivfflat index looked like on the day the game
-- was played, and several were reported. Exact-search values land in
-- `sender_scores_v2` so both eras stay inspectable and diffable.
--
-- Additive and reversible. Safe to run before the vector teardown.

ALTER TABLE games
    ADD COLUMN IF NOT EXISTS sender_scores_v2 JSONB,
    ADD COLUMN IF NOT EXISTS scoring_version_v2 TEXT;

COMMENT ON COLUMN games.sender_scores IS
    'Historical scores as computed at play time (approximate ivfflat retrieval, '
    'index rebuilt several times during Jan 2026). Immutable — do not backfill.';

COMMENT ON COLUMN games.sender_scores_v2 IS
    'Scores recomputed with exact in-process cosine search. Reproducible. '
    'Populated by scripts/rescore_archive.py.';

COMMENT ON COLUMN games.scoring_version_v2 IS
    'Scoring version used to produce sender_scores_v2.';

SELECT 'Migration 123: sender_scores_v2 added' as status;
