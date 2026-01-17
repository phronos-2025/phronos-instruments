-- Debug: Find where vector types and operators are

-- 1. Where is the vector extension installed?
SELECT extname, extnamespace::regnamespace as schema
FROM pg_extension
WHERE extname = 'vector';

-- 2. What type is the embedding column?
SELECT
    column_name,
    data_type,
    udt_schema,
    udt_name
FROM information_schema.columns
WHERE table_name = 'vocabulary_embeddings'
AND column_name = 'embedding';

-- 3. What vector-related types exist and in which schema?
SELECT
    n.nspname as schema,
    t.typname as type_name
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE t.typname LIKE '%vector%' OR t.typname LIKE '%halfvec%'
ORDER BY n.nspname, t.typname;

-- 4. What <=> operators exist?
SELECT
    n.nspname as operator_schema,
    o.oprname as operator,
    lt.typname as left_type,
    ltn.nspname as left_type_schema,
    rt.typname as right_type,
    rtn.nspname as right_type_schema
FROM pg_operator o
JOIN pg_type lt ON o.oprleft = lt.oid
JOIN pg_namespace ltn ON lt.typnamespace = ltn.oid
JOIN pg_type rt ON o.oprright = rt.oid
JOIN pg_namespace rtn ON rt.typnamespace = rtn.oid
JOIN pg_namespace n ON o.oprnamespace = n.oid
WHERE o.oprname = '<=>'
ORDER BY n.nspname, lt.typname;
