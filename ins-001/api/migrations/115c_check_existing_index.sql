-- Migration 115c: Check what indexes already exist
--
-- Before trying to create a new index, let's see what's already there

-- 1. Check all indexes on vocabulary_embeddings
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'vocabulary_embeddings';

-- 2. Check column type
SELECT
    column_name,
    udt_name as column_type
FROM information_schema.columns
WHERE table_name = 'vocabulary_embeddings'
AND column_name = 'embedding';

-- 3. Check table size
SELECT
    relname as table_name,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE relname = 'vocabulary_embeddings';

-- 4. Check pgvector version
SELECT extversion FROM pg_extension WHERE extname = 'vector';

-- 5. Test the function as-is (will it work with existing index?)
SELECT * FROM get_statistical_union(
    (SELECT embedding::text FROM vocabulary_embeddings WHERE word = 'cat' LIMIT 1),
    (SELECT embedding::text FROM vocabulary_embeddings WHERE word = 'dog' LIMIT 1),
    5
);
