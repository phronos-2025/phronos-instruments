# Vercel Environment Variables Check

## Issue
Frontend can't connect to API. CORS is configured correctly, so the issue is likely missing `PUBLIC_API_URL` in Vercel.

## Quick Fix

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select your project: `phronos-instruments`
   - Go to **Settings** → **Environment Variables**

2. **Check for `PUBLIC_API_URL`:**
   - If it's missing, add it
   - If it exists, verify the value

3. **Set the value:**
   ```
   PUBLIC_API_URL=https://phronos-instruments-production.up.railway.app
   ```
   
   **Important:**
   - Use `PUBLIC_` prefix (required for Astro)
   - Include `https://` protocol
   - No trailing slash

4. **Redeploy:**
   - After adding/updating the env var, Vercel should auto-redeploy
   - Or manually trigger a redeploy from the Deployments tab

5. **Verify:**
   - Open browser console on your deployed site
   - Type: `import.meta.env.PUBLIC_API_URL`
   - Should show: `https://phronos-instruments-production.up.railway.app`
   - NOT `http://localhost:8000` (that means env var is missing)

## Current Required Environment Variables

Make sure these are all set in Vercel:

```bash
PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PUBLIC_API_URL=https://phronos-instruments-production.up.railway.app
```

## Why This Happens

The frontend code defaults to `http://localhost:8000` if `PUBLIC_API_URL` is not set:

```typescript
const rawApiUrl = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000';
```

If the env var is missing, the frontend tries to connect to `localhost:8000`, which doesn't exist in production, causing the network error.
