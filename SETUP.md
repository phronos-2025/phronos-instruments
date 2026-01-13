# INS-001 Setup Guide

Step-by-step instructions for deploying INS-001 to production.

## Prerequisites

- GitHub account
- Supabase account (free tier works)
- Railway account (free tier works)
- Vercel account (free tier works)
- OpenAI API key
- Anthropic API key (for Claude)

---

## Step 1: Supabase Setup (Database)

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in:
   - **Name**: `phronos-instruments` (or your choice)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is fine for MVP
4. Click "Create new project"
5. Wait 2-3 minutes for project to initialize

### 1.2 Get Supabase Credentials

1. In your project dashboard, go to **Settings** → **API**
2. Copy these values (you'll need them later):

   **For new projects (recommended):**
   - **Project URL**: `https://lpkxyfacvbjtvozrofyd.supabase.co`
   - **Publishable key** (`sb_publishable_...`): Use for frontend/client-side
   - **Secret key** (`sb_secret_...`): Use for backend/server-side (⚠️ Keep secret!)
   
   **For legacy projects (still supported):**
   - **Project URL**: `https://lpkxyfacvbjtvozrofyd.supabase.co`
   - **anon key** (JWT): Use for frontend/client-side
   - **service_role key** (JWT): Use for backend/server-side (⚠️ Keep secret!)

   **Note:** New publishable/secret keys are recommended as they can be rotated independently. Legacy `anon`/`service_role` keys still work but are being phased out. See [Supabase API Keys docs](https://supabase.com/docs/guides/api/api-keys) for details.

### 1.3 Run Database Migrations

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Open `ins-001/api/migrations/001_initial_fallback.sql` in your editor
4. Copy the entire contents
5. Paste into Supabase SQL Editor
6. Click "Run" (or press Cmd/Ctrl + Enter)
7. Wait for success message

**Verify tables were created:**
- Go to **Table Editor**
- You should see: `users`, `games`, `share_tokens`, `vocabulary_embeddings`, `user_profiles`, `social_edges`

### 1.4 Create Analytics Views

1. In SQL Editor, create a new query
2. Copy contents of `analytics/views/games_analysis.sql`
3. Run it
4. Create another query with `analytics/views/user_profiles_analysis.sql`
5. Run it

**Verify views:**
- Go to **Table Editor** → Switch to "Views" tab
- You should see `analytics.games_complete` and `analytics.user_profiles_extended`

### 1.5 Enable pgvector Extension

1. In SQL Editor, run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
   **Note:** `halfvec` extension is not available on all Supabase instances. The fallback migration uses `vector` type instead.

2. Verify in **Database** → **Extensions** that `vector` is enabled

---

## Step 2: Railway Setup (API Backend)

### 2.1 Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"

### 2.2 Connect Repository

1. Select your `phronos-instruments` repository
2. Railway will detect it's a Python project
3. **Don't deploy yet** - we need to configure first

### 2.3 Configure Build Settings

1. In Railway project, go to **Settings** → **Build**
2. Set:
   - **Root Directory**: `ins-001/api` ⚠️ **CRITICAL - Must set this!**
   - **Build Command**: (leave empty, Railway auto-detects from requirements.txt)
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

**Important:** 
- Root Directory must be set to `ins-001/api` (not the repo root)
- `requirements.txt` exists in `ins-001/api/`
- `runtime.txt` specifies Python 3.11 (pydantic doesn't support Python 3.13 yet)
- Railway will auto-detect Python from `runtime.txt` or `requirements.txt`

### 2.4 Set Environment Variables

Go to **Variables** tab and add:

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
# Use publishable key (sb_publishable_...) OR anon key (JWT) for client-side
SUPABASE_ANON_KEY=sb_publishable_... (or anon JWT key)
# Use secret key (sb_secret_...) OR service_role key (JWT) for backend
SUPABASE_SERVICE_KEY=sb_secret_... (or service_role JWT key)

# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# App Config
APP_ENV=production
APP_URL=https://api.instruments.phronos.org (or Railway's generated domain)
FRONTEND_URL=https://instruments.phronos.org (or Vercel's domain)

# Optional (for later)
POSTHOG_API_KEY=
SENTRY_DSN=
```

**Important**: 
- Replace `xxxxx` with your actual Supabase project ID
- Get OpenAI key from [platform.openai.com](https://platform.openai.com/api-keys)
- Get Anthropic key from [console.anthropic.com](https://console.anthropic.com)
- Use **publishable/secret keys** (new) OR **anon/service_role keys** (legacy) - both work

### 2.5 Deploy

1. Railway will auto-deploy when you push to main branch
2. Or click **Deploy** button
3. Wait for build to complete (2-3 minutes)
4. Copy the generated domain (e.g., `https://xxxxx.up.railway.app`)

### 2.6 Test API

1. Visit `https://your-railway-domain.railway.app/health`
2. Should see: `{"status":"healthy","version":"2.5.0"}`
3. Visit `https://your-railway-domain.railway.app/docs` for API docs

### 2.7 Custom Domain (Optional)

1. In Railway, go to **Settings** → **Domains**
2. Add custom domain: `api.instruments.phronos.org`
3. Follow DNS instructions (add CNAME record)
4. Wait for SSL certificate (5-10 minutes)

---

## Step 3: Load Vocabulary Embeddings

**⚠️ CRITICAL: Do this BEFORE testing the frontend!**

The API needs vocabulary data to function.

### 3.1 Local Setup (Recommended)

1. In your terminal:
   ```bash
   cd ins-001/api
   pip install -r requirements.txt
   ```

2. Create `.env` file (use your secure location, not in repo):
   ```bash
   SUPABASE_URL=https://xxxxx.supabase.co
   # Use secret key (sb_secret_...) OR service_role key (JWT) for backend scripts
   SUPABASE_SERVICE_KEY=sb_secret_... (or service_role JWT key)
   OPENAI_API_KEY=sk-...
   ```

3. Run the script:
   ```bash
   python3 scripts/embed_vocabulary.py
   ```

4. This will take 10-15 minutes and cost ~$0.50 in OpenAI credits
5. You'll see progress: `Processing batch 1/25...`

### 3.2 Create Index (After Loading) - ⚠️ Free Tier Limitation

**Note:** Supabase Free tier has limited `maintenance_work_mem` (32 MB), which may not be enough to create the IVFFlat index on 50K vectors. The API will work without the index, but noise floor queries will be slower.

**Option 1: Skip for now (Recommended for MVP)**
- The API works fine without the index
- Noise floor queries will use sequential scan (slower but functional)
- You can add the index later when upgrading to a paid tier

**Option 2: Try creating with minimal lists**
```sql
DROP INDEX IF EXISTS idx_vocab_embedding;
CREATE INDEX idx_vocab_embedding ON vocabulary_embeddings 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
```
If this fails with memory error, proceed without the index.

**Option 3: Upgrade to paid tier**
- Paid tiers have more memory and can create the index with 100 lists
- Better performance for production use

### 3.3 Verify Vocabulary Loaded

1. In Supabase Table Editor → `vocabulary_embeddings`
2. Should see ~50,000 rows
3. Check a few words: `SELECT word FROM vocabulary_embeddings LIMIT 10;`

---

## Step 4: Vercel Setup (Frontend)

### 4.1 Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New..." → "Project"

### 4.2 Import Repository

1. Select your `phronos-instruments` repository
2. Vercel will auto-detect it's an Astro project

### 4.3 Configure Build Settings

1. Set:
   - **Root Directory**: `ins-001/web`
   - **Framework Preset**: Astro
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 4.4 Set Environment Variables

Go to **Environment Variables** and add:

```bash
PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
# Use publishable key (sb_publishable_...) OR anon key (JWT) - safe to expose
PUBLIC_SUPABASE_ANON_KEY=sb_publishable_... (or anon JWT key)
PUBLIC_API_URL=https://api.instruments.phronos.org (or Railway domain)
```

**Important**: 
- Use `PUBLIC_` prefix (required for Astro)
- Use publishable key OR anon key - these are safe to expose in frontend code
- NEVER use secret key or service_role key in frontend (security risk!)

### 4.5 Deploy

1. Click "Deploy"
2. Wait 2-3 minutes for build
3. Copy the generated domain (e.g., `https://xxxxx.vercel.app`)

### 4.6 Custom Domain (Optional)

1. In Vercel project, go to **Settings** → **Domains**
2. Add: `instruments.phronos.org`
3. Follow DNS instructions (add CNAME or A record)
4. Wait for SSL (automatic, ~1 minute)

---

## Step 5: Update CORS in Railway

After you have your Vercel domain:

1. Go back to Railway → **Variables**
2. Update `FRONTEND_URL` to your Vercel domain
3. Railway will auto-redeploy
4. Or update `ins-001/api/app/main.py` CORS origins and redeploy

---

## Step 6: Test End-to-End

### 6.1 Test Frontend

1. Visit your Vercel domain
2. Should see IntroScreen with consent checkbox
3. Click "Begin Assessment"
4. Enter a seed word (e.g., "cat")
5. Should see noise floor and clue inputs

### 6.2 Test API

1. Open browser console (F12)
2. Check for errors
3. Try creating a game - should work if vocabulary is loaded

### 6.3 Test Share Flow

1. Complete a game (or use LLM recipient)
2. Create share link
3. Open link in incognito window
4. Should see JoinScreen with clues
5. Enter guesses and submit
6. Should see results with seed word revealed

---

## Troubleshooting

### API Returns 500 Errors

- **Check vocabulary**: Make sure `vocabulary_embeddings` table has data
- **Check logs**: Railway → **Deployments** → Click latest → **View Logs**
- **Check environment variables**: All required vars set?

### Frontend Can't Connect to API

- **Check CORS**: Railway CORS origins include Vercel domain?
- **Check API URL**: `PUBLIC_API_URL` matches Railway domain?
- **Check browser console**: Look for CORS errors

### Supabase RLS Errors

- **Check auth**: User must be authenticated (anonymous is fine)
- **Check RLS policies**: Should be created by migration
- **Check API keys**: Use correct key type (publishable/anon for frontend, secret/service_role for backend)

### Vocabulary Script Fails

- **Check OpenAI key**: Valid and has credits?
- **Check Supabase connection**: Can connect to database?
- **Check batch size**: Should be 2000 (under 2048 limit)

---

## API Key Reference

Based on [Supabase API Keys documentation](https://supabase.com/docs/guides/api/api-keys):

| Key Type | Format | Use Case | Security |
|----------|--------|----------|----------|
| **Publishable** | `sb_publishable_...` | Frontend, mobile apps, public code | Safe to expose |
| **Secret** | `sb_secret_...` | Backend servers, Edge Functions | ⚠️ Keep secret! |
| **anon** (legacy) | JWT | Frontend (being phased out) | Safe to expose |
| **service_role** (legacy) | JWT | Backend (being phased out) | ⚠️ Keep secret! |

**Recommendation:** Use new publishable/secret keys when possible. They can be rotated independently and are more secure.

---

## Next Steps

1. **Monitor**: Set up error tracking (Sentry) and analytics (PostHog)
2. **Backup**: Set up Supabase backups (automatic on paid tier)
3. **Scale**: Monitor Railway usage, upgrade if needed
4. **Domain**: Configure DNS for custom domains
5. **SSL**: Verify SSL certificates are active (automatic on Vercel/Railway)

---

## Cost Estimates (MVP)

- **Supabase**: Free tier (500MB database, 2GB bandwidth)
- **Railway**: Free tier ($5 credit/month, ~500 hours)
- **Vercel**: Free tier (100GB bandwidth)
- **OpenAI**: ~$0.50 one-time (vocabulary) + ~$0.01 per game
- **Anthropic**: ~$0.01 per LLM game

**Total**: ~$0-5/month for MVP

---

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **Project Issues**: Check `ins-001/docs/` for architecture details
