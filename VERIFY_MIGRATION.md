# Verify Migration Success

After running `001_initial.sql`, verify everything was created correctly.

## Quick Verification Queries

Run these in Supabase SQL Editor to check:

### 1. Check Tables Exist

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'games', 'share_tokens', 'vocabulary_embeddings', 'user_profiles', 'social_edges')
ORDER BY table_name;
```

**Expected**: Should return 6 rows

### 2. Check Extensions Enabled

```sql
SELECT extname, extversion 
FROM pg_extension 
WHERE extname IN ('vector', 'pg_cron');
```

**Expected**: 
- `vector` should exist (required)
- `pg_cron` may or may not exist (optional - see note below)

### 3. Check Functions Exist

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'sync_user_anonymous_status',
    'get_noise_floor_by_embedding',
    'join_game_via_token',
    'recreate_vocabulary_index'
  )
ORDER BY routine_name;
```

**Expected**: Should return 4 rows

### 4. Check RLS Enabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'games', 'share_tokens', 'vocabulary_embeddings', 'user_profiles', 'social_edges');
```

**Expected**: All should have `rowsecurity = true`

### 5. Check Cron Jobs (if pg_cron enabled)

```sql
SELECT jobid, schedule, command 
FROM cron.job 
WHERE jobname IN ('expire-games', 'cleanup-anon-users');
```

**Expected**: Should return 2 rows if pg_cron is enabled

---

## About pg_cron

**Important**: `pg_cron` may not be available on Supabase Free tier. This is **OK** - the cron jobs are optional:

- **expire-games**: Expires old games hourly (you can run manually if needed)
- **cleanup-anon-users**: Cleans up old anonymous users daily (not critical for MVP)

### If pg_cron Failed

You'll see an error like:
```
ERROR: extension "pg_cron" does not exist
```

**Solution**: 
1. Remove the cron job lines from the migration (lines 318-337)
2. Or ignore the error - the rest of the migration still works
3. The cron jobs are nice-to-have, not required for MVP

### Manual Alternatives

If pg_cron isn't available, you can:

1. **Expire games manually** (when needed):
   ```sql
   UPDATE games SET status = 'expired' 
   WHERE status IN ('pending_clues', 'pending_guess') 
   AND expires_at < NOW();
   ```

2. **Clean up anonymous users** (when needed):
   ```sql
   DELETE FROM auth.users 
   WHERE id IN (
     SELECT u.id FROM users u
     WHERE u.is_anonymous = true 
     AND u.created_at < NOW() - INTERVAL '30 days'
     AND u.id NOT IN (
       SELECT DISTINCT sender_id FROM games WHERE sender_id IS NOT NULL
       UNION
       SELECT DISTINCT recipient_id FROM games WHERE recipient_id IS NOT NULL
     )
   );
   ```

Or set up a Railway cron job later to call these periodically.

---

## Next Steps

Once verification passes:

1. ✅ **Tables created** → Proceed to load vocabulary
2. ✅ **Functions created** → API can use them
3. ✅ **RLS enabled** → Security is working
4. ⚠️ **pg_cron** → Optional, can skip if not available

**You're ready to load vocabulary embeddings!**
