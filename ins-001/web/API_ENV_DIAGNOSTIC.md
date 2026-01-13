# API Environment Variable Diagnostic

## The Problem
`PUBLIC_API_URL` is set in Vercel, but the frontend still can't connect to the API.

## Critical: Astro Environment Variables are Build-Time

**Important:** In Astro, `PUBLIC_` environment variables are **baked into the build at build time**. This means:

1. ✅ If you add/update an env var → **Vercel must rebuild** for it to take effect
2. ✅ The env var must be present **during the build**, not just at runtime
3. ✅ If the build happened before the env var was added, it won't be available

## Check These Issues

### 1. Verify the Value is Complete

In Vercel → Settings → Environment Variables, click on `PUBLIC_API_URL` and verify:

- ✅ **Must start with `https://`** (not just the domain)
- ✅ **Full domain:** `https://phronos-instruments-production.up.railway.app`
- ✅ **No trailing slash:** Should NOT end with `/`
- ✅ **Not truncated:** Make sure the full value is there

**Correct:**
```
https://phronos-instruments-production.up.railway.app
```

**Wrong:**
```
phronos-instruments-production.up.railway.app  (missing https://)
https://phronos-instruments-production.u...  (truncated)
https://phronos-instruments-production.up.railway.app/  (trailing slash)
```

### 2. Check Environment Scope

Vercel has different environments:
- **Production** (for production deployments)
- **Preview** (for PR previews)
- **Development** (for local dev)

**Action:** Make sure `PUBLIC_API_URL` is set for **all environments** (or at least Production):

1. In Vercel → Settings → Environment Variables
2. Click on `PUBLIC_API_URL`
3. Check which environments it's enabled for
4. If it's only set for Preview, add it to Production too

### 3. Force a Rebuild

After verifying the value:

1. Go to Vercel → Deployments
2. Click **"Redeploy"** on the latest deployment
3. **Important:** Uncheck "Use existing Build Cache"
4. This forces a fresh build with the env vars

### 4. Check Browser Console

After redeploying, open your deployed site and check the browser console:

```javascript
// Should show the full API URL
import.meta.env.PUBLIC_API_URL
```

**Expected output:**
```
"https://phronos-instruments-production.up.railway.app"
```

**If it shows:**
- `undefined` → Env var not set or not in build
- `"http://localhost:8000"` → Using default (env var missing)
- Truncated value → Value is incomplete in Vercel

### 5. Enhanced Debugging

I've added enhanced logging. After redeploying, check the browser console for:

```
=== API CONFIGURATION DEBUG ===
PUBLIC_API_URL from env: [should show the value]
rawApiUrl: [should show the value]
API_URL (normalized): [should show https://...]
Is using default (localhost)? false
================================
```

This will tell you exactly what the frontend sees.

## Quick Fix Checklist

1. ✅ Verify `PUBLIC_API_URL` value is complete: `https://phronos-instruments-production.up.railway.app`
2. ✅ Check it's set for Production environment (not just Preview)
3. ✅ Redeploy with cache cleared
4. ✅ Check browser console for debug output
5. ✅ Verify `import.meta.env.PUBLIC_API_URL` shows the correct value

## Most Likely Issue

Based on the screenshot showing a truncated value, the env var might be:
- Missing the `https://` protocol
- Incomplete/truncated
- Only set for Preview environment

Fix: Edit the env var in Vercel, ensure it's the full URL with `https://`, set for Production, and redeploy.
