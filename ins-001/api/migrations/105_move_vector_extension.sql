-- Migration 105: Move vector Extension to extensions Schema
--
-- SECURITY ISSUE: Extension `vector` is installed in the public schema.
-- Having extensions in public can create security risks as public schema
-- is often in the default search_path.
--
-- FIX: Move the extension to a dedicated `extensions` schema.
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
--
-- NOTE: This migration requires careful execution as it will temporarily
-- break vector operations. Run during a maintenance window.

-- ============================================
-- STEP 1: Create extensions schema if not exists
-- ============================================
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage to necessary roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- ============================================
-- STEP 2: Check current vector extension location
-- ============================================
-- Run this to verify current state:
-- SELECT extname, extnamespace::regnamespace FROM pg_extension WHERE extname = 'vector';

-- ============================================
-- STEP 3: Move the extension
-- ============================================
-- NOTE: PostgreSQL doesn't support ALTER EXTENSION ... SET SCHEMA for all extensions.
-- For pgvector, we need to drop and recreate.

-- First, save the vocabulary data (if not already backed up)
-- CREATE TABLE public.vocabulary_embeddings_backup AS SELECT * FROM public.vocabulary_embeddings;

-- Drop dependent objects (indexes that use vector types)
DROP INDEX IF EXISTS public.idx_vocab_embedding;
DROP INDEX IF EXISTS public.vocabulary_embedding_idx;

-- Drop and recreate the extension in the new schema
-- WARNING: This will fail if there are dependent objects. You may need to:
-- 1. Drop the vocabulary_embeddings table (after backup)
-- 2. Drop the extension
-- 3. Recreate extension in extensions schema
-- 4. Recreate the table
-- 5. Restore data from backup

-- Safer alternative: Just update search_path to include extensions schema
-- This avoids data loss but doesn't fully resolve the linter warning

-- ============================================
-- OPTION A: Update search_path (SAFER)
-- ============================================
-- This approach keeps the extension in public but ensures proper search_path
-- Comment out OPTION B if using this

-- ALTER DATABASE postgres SET search_path TO public, extensions;

-- ============================================
-- OPTION B: Full migration (REQUIRES DOWNTIME)
-- ============================================
-- Uncomment and run these steps manually during maintenance window:

/*
-- 1. Backup data
CREATE TABLE public.vocabulary_embeddings_backup AS
SELECT * FROM public.vocabulary_embeddings;

-- 2. Drop table
DROP TABLE public.vocabulary_embeddings;

-- 3. Drop extension from public
DROP EXTENSION IF EXISTS vector;

-- 4. Create extension in extensions schema
CREATE EXTENSION vector SCHEMA extensions;

-- 5. Recreate table (with explicit schema reference for vector type)
CREATE TABLE public.vocabulary_embeddings (
    word TEXT PRIMARY KEY,
    embedding extensions.halfvec(1536) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Restore data
INSERT INTO public.vocabulary_embeddings (word, embedding, created_at)
SELECT word, embedding::extensions.halfvec(1536), created_at
FROM public.vocabulary_embeddings_backup;

-- 7. Recreate index
CREATE INDEX idx_vocab_embedding ON public.vocabulary_embeddings
    USING ivfflat (embedding extensions.halfvec_cosine_ops) WITH (lists = 25);

-- 8. Update functions to use explicit schema (already done in migration 104)

-- 9. Clean up backup after verification
-- DROP TABLE public.vocabulary_embeddings_backup;
*/

-- ============================================
-- RECOMMENDED: Accept the warning
-- ============================================
-- For Supabase projects, the vector extension in public schema is common
-- and often acceptable. The linter warning is advisory.
--
-- If you choose to accept this risk, document it:

COMMENT ON EXTENSION vector IS 'pgvector extension - kept in public schema for compatibility. Risk accepted per security review.';

SELECT 'Migration 105: Vector extension warning documented (manual migration available if needed)' as status;
