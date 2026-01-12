# Migration Fallback: Using vector instead of halfvec

## Problem

Your Supabase instance doesn't have the `halfvec` extension available. This is common on some Supabase instances.

## Solution

Use the fallback migration that uses `vector(1536)` instead of `halfvec(1536)`.

## Storage Impact

- **halfvec**: ~150MB for 50K words (16-bit floats)
- **vector**: ~300MB for 50K words (32-bit floats)
- **Free tier limit**: 500MB
- **Result**: Still fits comfortably! ✅

## Steps

### 1. Clean up partially created tables

If the migration partially ran and created tables, drop them first:

**Option A: Run the cleanup script (recommended)**
1. Open Supabase SQL Editor
2. Copy the entire contents of `ins-001/api/migrations/000_cleanup.sql`
3. Paste and run it
4. This will drop all INS-001 tables and functions cleanly

**Option B: Manual cleanup**
```sql
DROP TABLE IF EXISTS social_edges CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS share_tokens CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS vocabulary_embeddings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP FUNCTION IF EXISTS sync_user_anonymous_status() CASCADE;
DROP FUNCTION IF EXISTS get_noise_floor_by_embedding(vector, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS join_game_via_token(TEXT) CASCADE;
DROP FUNCTION IF EXISTS recreate_vocabulary_index() CASCADE;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
```

### 2. Run the fallback migration

1. Open Supabase SQL Editor
2. Copy the entire contents of `ins-001/api/migrations/001_initial_fallback.sql`
3. Paste and run
4. Should complete successfully

### 3. Verify

Run these checks:

```sql
-- Check table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'vocabulary_embeddings';

-- Check column type (should be vector, not halfvec)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vocabulary_embeddings' 
AND column_name = 'embedding';

-- Check function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'get_noise_floor_by_embedding';
```

### 4. Update vocabulary script (if needed)

The vocabulary script should work as-is, but verify it's inserting `vector` type correctly. Supabase Python client should handle the conversion automatically.

## What Changed

1. **Table definition**: `embedding vector(1536)` instead of `embedding halfvec(1536)`
2. **Index**: `vector_cosine_ops` instead of `halfvec_cosine_ops`
3. **Function**: `get_noise_floor_by_embedding` accepts `vector(1536)` instead of `halfvec(1536)`
4. **Index recreation**: `recreate_vocabulary_index()` uses `vector_cosine_ops`

## Performance

- **Precision**: Slightly better (32-bit vs 16-bit), but negligible for cosine similarity
- **Storage**: 2x larger, but still within free tier
- **Query speed**: Same (index structure is identical)

## Next Steps

After running the fallback migration:

1. ✅ Verify tables and functions exist
2. ✅ Proceed to load vocabulary embeddings
3. ✅ Test API endpoints

The rest of the setup remains the same!
