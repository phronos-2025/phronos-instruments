# Troubleshooting "Failed to Fetch" Error

## Problem
Frontend shows "Failed to fetch" when trying to create a game.

## Common Causes

### 1. Missing `PUBLIC_API_URL` in Vercel

**Check:**
1. Go to Vercel project → **Settings** → **Environment Variables**
2. Look for `PUBLIC_API_URL`
3. If missing, add it with your Railway API domain

**Fix:**
1. Get your Railway API domain (e.g., `https://xxxxx.up.railway.app`)
2. In Vercel → **Settings** → **Environment Variables**, add:
   ```
   PUBLIC_API_URL=https://xxxxx.up.railway.app
   ```
3. Redeploy the frontend (Vercel will auto-redeploy after adding env vars)

### 2. CORS Not Configured

**Check:**
1. Open browser console (F12) → Network tab
2. Try creating a game
3. Look for CORS error in the failed request

**Fix:**
1. Get your Vercel frontend domain (e.g., `https://xxxxx.vercel.app`)
2. In Railway → **Variables**, update:
   ```
   FRONTEND_URL=https://xxxxx.vercel.app
   ```
3. Railway will auto-redeploy

**Or manually update CORS:**
- Edit `ins-001/api/app/main.py`
- Add your Vercel domain to `allow_origins` list
- Commit and push (Railway will redeploy)

### 3. API Not Running

**Check:**
1. Visit your Railway API domain: `https://xxxxx.up.railway.app/health`
2. Should see: `{"status":"healthy","version":"2.5.0"}`

**If not working:**
- Check Railway logs for errors
- Verify all environment variables are set in Railway
- Check that vocabulary is loaded in Supabase

### 4. Network/Firewall Issue

**Check:**
- Try accessing the API directly in browser
- Check if Railway domain is accessible

## Quick Fix Checklist

1. ✅ **Vercel Environment Variables:**
   - `PUBLIC_SUPABASE_URL` = Your Supabase URL
   - `PUBLIC_SUPABASE_ANON_KEY` = Your publishable/anon key
   - `PUBLIC_API_URL` = Your Railway API domain (e.g., `https://xxxxx.up.railway.app`)

2. ✅ **Railway Environment Variables:**
   - `FRONTEND_URL` = Your Vercel domain (e.g., `https://xxxxx.vercel.app`)
   - All other required vars (Supabase, OpenAI, Anthropic keys)

3. ✅ **Test API directly:**
   - Visit `https://your-railway-domain.railway.app/health`
   - Should return JSON

4. ✅ **Check browser console:**
   - Open DevTools (F12) → Console tab
   - Look for specific error messages
   - Check Network tab for failed requests

## Debug Steps

1. **Check what API URL the frontend is using:**
   - Open browser console
   - Type: `import.meta.env.PUBLIC_API_URL`
   - Should show your Railway domain, not `localhost:8000`

2. **Test API endpoint directly:**
   ```bash
   curl https://your-railway-domain.railway.app/health
   ```

3. **Check CORS:**
   - Open browser console → Network tab
   - Try creating a game
   - Look at the failed request → Headers
   - Check if `Access-Control-Allow-Origin` header is present

## Still Not Working?

- Check Railway deployment logs for API errors
- Check Vercel deployment logs for frontend errors
- Verify vocabulary is loaded in Supabase (`vocabulary_embeddings` table has ~50K rows)
- Make sure both services are deployed and running
