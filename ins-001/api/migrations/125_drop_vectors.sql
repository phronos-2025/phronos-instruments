-- Migration 125: Drop the vocabulary vectors from Postgres
--
-- The deployed API serves the vocabulary from a memory-mapped .npy artifact and
-- no longer references this table or its RPCs (verified live: noise-floor and
-- statistical-union run in-process). This reclaims ~479 MB — the whole reason the
-- database was over the Free-tier budget.
--
-- The vocabulary_embeddings DATA is preserved as the GitHub Release artifact
-- (vocab-artifact-v1, sha256 95b350…) and in the pre-drop pg_dump. To restore,
-- recreate the table and reload from vocab_embeddings.npy.
--
-- The `vector` extension is deliberately LEFT INSTALLED: it is a few hundred KB of
-- function definitions (no storage impact on the 500 MB cap), and dropping it on a
-- live Supabase-managed database is a needless risk. It can be removed later with
-- `DROP EXTENSION vector;` once nothing depends on it.

-- 1. ivfflat index (235 MB). Redundant with the table drop, but explicit.
DROP INDEX IF EXISTS public.idx_vocab_embedding;

-- 2. The four vector RPCs the API used to call (all superseded by numpy).
DROP FUNCTION IF EXISTS public.get_noise_floor_by_embedding(text, text, integer);
DROP FUNCTION IF EXISTS public.get_statistical_union(text, text, integer);
DROP FUNCTION IF EXISTS public.get_distant_words(text, integer);
DROP FUNCTION IF EXISTS public.get_nearest_word_excluding(text, text[], integer);

-- 3. The table itself (heap + TOAST, ~244 MB).
DROP TABLE IF EXISTS public.vocabulary_embeddings;

SELECT 'Migration 125: vocabulary_embeddings, ivfflat index, and 4 vector RPCs dropped' as status;
