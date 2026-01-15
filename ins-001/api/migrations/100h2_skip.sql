-- Migration 100h2 SKIP: Mark vocabulary linking as optional
-- Run this if you want to skip linking vocabulary to model version
-- The system works fine without it - it's just for tracking

-- Verify the column exists but leave it NULL
SELECT
    'model_version_id column exists: ' ||
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'vocabulary_embeddings'
        AND column_name = 'model_version_id'
    ) THEN 'YES' ELSE 'NO' END as status;

SELECT 'Phase 100h2: Skipped (vocabulary linking is optional)' as status;
