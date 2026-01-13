-- Migration 002: Fix get_noise_floor_by_embedding function overload (AUTO-DETECT)
-- INS-001 Semantic Associations
-- 
-- Issue: PostgREST can't choose between halfvec and vector overloads (PGRST203 error)
-- Solution: Automatically detect table type and drop the other function
--
-- Run this in Supabase SQL Editor if you get PGRST203 error

-- Drop both functions first
DROP FUNCTION IF EXISTS get_noise_floor_by_embedding(halfvec, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS get_noise_floor_by_embedding(vector, TEXT, INT) CASCADE;

-- Automatically detect which type the table uses and create the matching function
DO $$
DECLARE
    embedding_udt_name TEXT;
BEGIN
    -- Get the UDT name (halfvec or vector)
    SELECT udt_name INTO embedding_udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'vocabulary_embeddings'
    AND column_name = 'embedding';
    
    -- Create the function matching the table type
    IF embedding_udt_name = 'halfvec' THEN
        EXECUTE '
        CREATE OR REPLACE FUNCTION get_noise_floor_by_embedding(
            seed_embedding halfvec(1536),
            seed_word TEXT,
            k INT DEFAULT 20
        )
        RETURNS TABLE(word TEXT, similarity FLOAT) AS $func$
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
        $func$ LANGUAGE plpgsql SECURITY DEFINER;
        ';
        RAISE NOTICE 'Created halfvec version (table uses halfvec)';
    ELSIF embedding_udt_name = 'vector' THEN
        EXECUTE '
        CREATE OR REPLACE FUNCTION get_noise_floor_by_embedding(
            seed_embedding vector(1536),
            seed_word TEXT,
            k INT DEFAULT 20
        )
        RETURNS TABLE(word TEXT, similarity FLOAT) AS $func$
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
        $func$ LANGUAGE plpgsql SECURITY DEFINER;
        ';
        RAISE NOTICE 'Created vector version (table uses vector)';
    ELSE
        RAISE EXCEPTION 'Could not determine embedding type. Found: %. Expected halfvec or vector.', embedding_udt_name;
    END IF;
END $$;
