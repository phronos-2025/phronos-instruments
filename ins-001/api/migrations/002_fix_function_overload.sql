-- Migration 002: Fix get_noise_floor_by_embedding function overload
-- INS-001 Semantic Associations
-- 
-- Issue: PostgREST can't choose between halfvec and vector overloads (PGRST203 error)
-- 
-- RECOMMENDED: Use 002_fix_function_overload_auto.sql instead (auto-detects type)
-- 
-- This file provides manual instructions if auto-detection doesn't work
--
-- STEP 1: Check which type your table uses
-- Run this query first:
-- SELECT udt_name FROM information_schema.columns 
-- WHERE table_name = 'vocabulary_embeddings' AND column_name = 'embedding';
--
-- STEP 2: Drop both functions
DROP FUNCTION IF EXISTS get_noise_floor_by_embedding(halfvec, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS get_noise_floor_by_embedding(vector, TEXT, INT) CASCADE;

-- STEP 3: Recreate ONLY the version matching your table
-- 
-- If udt_name = 'halfvec', uncomment the halfvec block below
-- If udt_name = 'vector', uncomment the vector block below

-- OPTION A: For halfvec tables (from 001_initial.sql)
/*
CREATE OR REPLACE FUNCTION get_noise_floor_by_embedding(
    seed_embedding halfvec(1536),
    seed_word TEXT,
    k INT DEFAULT 20
)
RETURNS TABLE(word TEXT, similarity FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.word,
        (1 - (v.embedding <=> seed_embedding))::FLOAT as similarity
    FROM vocabulary_embeddings v
    WHERE v.word != lower(seed_word)
    ORDER BY v.embedding <=> seed_embedding
    LIMIT k;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/

-- OPTION B: For vector tables (from 001_initial_fallback.sql)
/*
CREATE OR REPLACE FUNCTION get_noise_floor_by_embedding(
    seed_embedding vector(1536),
    seed_word TEXT,
    k INT DEFAULT 20
)
RETURNS TABLE(word TEXT, similarity FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.word,
        (1 - (v.embedding <=> seed_embedding))::FLOAT as similarity
    FROM vocabulary_embeddings v
    WHERE v.word != lower(seed_word)
    ORDER BY v.embedding <=> seed_embedding
    LIMIT k;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/
