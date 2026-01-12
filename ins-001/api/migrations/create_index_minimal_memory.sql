-- Create IVFFlat index with minimal memory requirements
-- For Supabase Free tier (32 MB maintenance_work_mem limit)
-- 
-- Using 25 lists to fit within memory constraints
-- This is the minimum recommended for 50K vectors

DROP INDEX IF EXISTS idx_vocab_embedding;

-- Create with 25 lists (minimal memory requirement)
CREATE INDEX idx_vocab_embedding ON vocabulary_embeddings 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 25);

-- Verify index was created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'vocabulary_embeddings';
