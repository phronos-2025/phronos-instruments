-- Create IVFFlat index with reduced memory requirements
-- For Supabase Free tier (limited maintenance_work_mem)
-- 
-- Using fewer lists (50 instead of 100) reduces memory requirement
-- Slightly slower queries but still much faster than no index

DROP INDEX IF EXISTS idx_vocab_embedding;

-- Create with 50 lists (reduces memory from ~65MB to ~32MB)
CREATE INDEX idx_vocab_embedding ON vocabulary_embeddings 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Verify index was created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'vocabulary_embeddings';
