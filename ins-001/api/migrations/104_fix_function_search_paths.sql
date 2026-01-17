-- Migration 104: Fix Function Search Path Vulnerabilities
--
-- SECURITY ISSUE: Functions without explicit search_path can be exploited
-- if an attacker creates objects in a schema that appears earlier in the search_path.
--
-- FIX: Set search_path = '' (empty) for all SECURITY DEFINER functions to ensure
-- only fully-qualified object names are used, preventing search path injection attacks.
--
-- NOTE: All type references (halfvec, vector) must be fully qualified as public.halfvec
-- since the vector extension is installed in the public schema.
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================
-- 0. DROP OLD FUNCTION VERSIONS (to clean up any without search_path)
-- ============================================
-- Drop any old versions that might not have search_path set
DROP FUNCTION IF EXISTS public.get_noise_floor_by_embedding(vector, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_noise_floor_by_embedding(halfvec, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_noise_floor_by_embedding(public.halfvec, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_distant_words(vector, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_distant_words(halfvec, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_distant_words(public.halfvec, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_distant_words(TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_nearest_word_excluding(vector, TEXT[], INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_nearest_word_excluding(halfvec, TEXT[], INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_nearest_word_excluding(public.halfvec, TEXT[], INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_statistical_union(TEXT, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.recreate_vocabulary_index() CASCADE;

-- ============================================
-- 1. MAILING LIST FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.unsubscribe_by_token(p_token TEXT)
RETURNS TABLE (
    email TEXT,
    is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    UPDATE public.mailing_list
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE unsubscribe_token = p_token
      AND is_active = TRUE
    RETURNING public.mailing_list.email, public.mailing_list.is_active;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_subscription_by_token(p_token TEXT)
RETURNS TABLE (
    email TEXT,
    is_active BOOLEAN,
    subscribed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.email,
        m.is_active,
        m.subscribed_at
    FROM public.mailing_list m
    WHERE m.unsubscribe_token = p_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.subscribe_authenticated_user(p_email TEXT, p_source TEXT DEFAULT 'website')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_subscription_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    INSERT INTO public.mailing_list (email, user_id, source)
    VALUES (p_email, v_user_id, p_source)
    ON CONFLICT (email) DO UPDATE SET
        user_id = COALESCE(public.mailing_list.user_id, v_user_id),
        is_active = TRUE,
        updated_at = NOW()
    RETURNING id INTO v_subscription_id;

    RETURN v_subscription_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_mailing_list_on_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.mailing_list
    SET user_id = NEW.id,
        updated_at = NOW()
    WHERE email = NEW.email
      AND user_id IS NULL;

    RETURN NEW;
END;
$$;

-- ============================================
-- 2. USER SYNC FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_user_anonymous_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.users (id, is_anonymous, created_at)
    VALUES (
        NEW.id,
        NEW.is_anonymous,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET is_anonymous = NEW.is_anonymous;
    RETURN NEW;
END;
$$;

-- ============================================
-- 3. VOCABULARY/EMBEDDING FUNCTIONS
-- Note: halfvec type must be qualified as public.halfvec
-- ============================================

-- Get noise floor by embedding (for open seed mode)
CREATE OR REPLACE FUNCTION public.get_noise_floor_by_embedding(
    seed_embedding public.halfvec(1536),
    seed_word TEXT,
    k INT DEFAULT 20
)
RETURNS TABLE(word TEXT, similarity FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.word,
        (1 - (v.embedding <=> seed_embedding))::FLOAT as similarity
    FROM public.vocabulary_embeddings v
    WHERE v.word != lower(seed_word)
    ORDER BY v.embedding <=> seed_embedding
    LIMIT k;
END;
$$;

-- Get distant words (halfvec version - for bridging suggestions)
CREATE OR REPLACE FUNCTION public.get_distant_words(
    query_embedding public.halfvec(1536),
    k INT DEFAULT 100
)
RETURNS TABLE(word TEXT, distance FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.word,
        (v.embedding <=> query_embedding)::FLOAT as distance
    FROM public.vocabulary_embeddings v
    ORDER BY v.embedding <=> query_embedding DESC
    LIMIT k;
END;
$$;

-- Get distant words (TEXT version - flexible casting)
CREATE OR REPLACE FUNCTION public.get_distant_words(
    query_embedding TEXT,
    k INT DEFAULT 100
)
RETURNS TABLE(word TEXT, distance FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.word,
        (v.embedding::public.vector(1536) <=> query_embedding::public.vector(1536))::FLOAT as distance
    FROM public.vocabulary_embeddings v
    ORDER BY distance DESC
    LIMIT k;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY
    SELECT
        v.word,
        (v.embedding <=> query_embedding::public.halfvec(1536))::FLOAT as distance
    FROM public.vocabulary_embeddings v
    ORDER BY distance DESC
    LIMIT k;
END;
$$;

-- Get nearest word excluding (for lexical bridge)
CREATE OR REPLACE FUNCTION public.get_nearest_word_excluding(
    query_embedding public.halfvec(1536),
    exclude_words TEXT[],
    k INT DEFAULT 1
)
RETURNS TABLE(word TEXT, similarity FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.word,
        (1 - (v.embedding <=> query_embedding))::FLOAT as similarity
    FROM public.vocabulary_embeddings v
    WHERE v.word != ALL(exclude_words)
    ORDER BY v.embedding <=> query_embedding
    LIMIT k;
END;
$$;

-- Vocabulary index recreation function
CREATE OR REPLACE FUNCTION public.recreate_vocabulary_index()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    embedding_type TEXT;
BEGIN
    SELECT udt_name INTO embedding_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vocabulary_embeddings'
      AND column_name = 'embedding';

    DROP INDEX IF EXISTS public.idx_vocab_embedding;

    IF embedding_type = 'halfvec' THEN
        EXECUTE 'CREATE INDEX idx_vocab_embedding ON public.vocabulary_embeddings
            USING ivfflat (embedding public.halfvec_cosine_ops) WITH (lists = 25)';
    ELSE
        EXECUTE 'CREATE INDEX idx_vocab_embedding ON public.vocabulary_embeddings
            USING ivfflat (embedding public.vector_cosine_ops) WITH (lists = 25)';
    END IF;
END;
$$;

-- Get statistical union (optimal path between anchor and target)
CREATE OR REPLACE FUNCTION public.get_statistical_union(
    anchor_word TEXT,
    target_word TEXT,
    k INT DEFAULT 5
)
RETURNS TABLE(word TEXT, score FLOAT, sim_anchor FLOAT, sim_target FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    anchor_emb public.halfvec(1536);
    target_emb public.halfvec(1536);
BEGIN
    SELECT embedding INTO anchor_emb
    FROM public.vocabulary_embeddings WHERE public.vocabulary_embeddings.word = lower(anchor_word);

    SELECT embedding INTO target_emb
    FROM public.vocabulary_embeddings WHERE public.vocabulary_embeddings.word = lower(target_word);

    IF anchor_emb IS NULL OR target_emb IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH candidates AS (
        (
            SELECT v.word, v.embedding
            FROM public.vocabulary_embeddings v
            WHERE v.word NOT IN (lower(anchor_word), lower(target_word))
            ORDER BY v.embedding <=> anchor_emb
            LIMIT 100
        )
        UNION
        (
            SELECT v.word, v.embedding
            FROM public.vocabulary_embeddings v
            WHERE v.word NOT IN (lower(anchor_word), lower(target_word))
            ORDER BY v.embedding <=> target_emb
            LIMIT 100
        )
    )
    SELECT
        c.word,
        ((1 - (c.embedding <=> anchor_emb)) + (1 - (c.embedding <=> target_emb)))::FLOAT as score,
        (1 - (c.embedding <=> anchor_emb))::FLOAT as sim_anchor,
        (1 - (c.embedding <=> target_emb))::FLOAT as sim_target
    FROM candidates c
    GROUP BY c.word, c.embedding
    ORDER BY score DESC
    LIMIT k;
END;
$$;

-- ============================================
-- RE-GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION public.get_distant_words(TEXT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_distant_words(public.halfvec, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_noise_floor_by_embedding(public.halfvec, TEXT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_nearest_word_excluding(public.halfvec, TEXT[], INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_statistical_union(TEXT, TEXT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recreate_vocabulary_index() TO service_role;
GRANT EXECUTE ON FUNCTION public.unsubscribe_by_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_by_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.subscribe_authenticated_user(TEXT, TEXT) TO authenticated;

SELECT 'Migration 104: All function search paths secured' as status;
