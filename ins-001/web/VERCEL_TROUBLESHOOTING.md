# Vercel Deployment Troubleshooting

## Current Issue
Build succeeds but changes aren't showing. Root `/` shows INS-001 game instead of landing page.

## CRITICAL: Check Vercel Project Settings

### Step 1: Verify Root Directory
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `phronos-instruments`
3. Go to **Settings** → **General**
4. Scroll to **Root Directory**
5. **MUST BE SET TO:** `ins-001/web`
6. If it's blank, `.`, `/`, or anything else → **CHANGE IT NOW**

### Step 2: Verify Build Settings
In the same Settings page, check:
- **Framework Preset:** Should be "Astro" (auto-detected)
- **Build Command:** Should be `npm run build` or blank (auto-detected)
- **Output Directory:** Should be blank (Astro adapter handles this)
- **Install Command:** Should be `npm install` or blank (auto-detected)

### Step 3: Clear Cache and Redeploy
1. In Settings → **Build & Development Settings**
2. Click **"Clear Build Cache"**
3. Go to **Deployments** tab
4. Click **"Redeploy"** on the latest deployment
5. Select **"Use existing Build Cache"** = **NO** (unchecked)

## Verification Tests

After redeploying, check:

1. **Visit `/`** - Should show:
   - 🔴 **RED BANNER** at top: "BUILD TIME: [timestamp] | LANDING PAGE v2.0 DEPLOYED"
   - Landing page with "The Lab" title
   - Instrument cards grid

2. **Visit `/ins-001/`** - Should show:
   - 🔵 **BLUE BANNER** at top: "INS-001 GAME PAGE v2.0 DEPLOYED"
   - 🟢 **GREEN BANNER**: "INSTRUMENT LAYOUT v2.0"
   - Game intro screen

3. **If you see NO banners:**
   - Wrong files are being built
   - Root Directory is incorrect
   - Vercel is serving cached content

## Common Issues

### Issue: Root Directory is Wrong
**Symptom:** Build succeeds but shows old UI, 404 on `/ins-001/`

**Solution:** Set Root Directory to `ins-001/web` in Vercel settings

### Issue: Cached Build
**Symptom:** Changes committed but not showing

**Solution:** Clear build cache and redeploy without cache

### Issue: Build Failing Silently
**Symptom:** Deployment shows "Ready" but old content

**Solution:** Check build logs for errors, verify all dependencies are in `package.json`

## File Structure Verification

The correct structure in git should be:
```
ins-001/web/src/pages/
  ├── index.astro              (Landing page - should show at /)
  └── ins-001/
      ├── index.astro          (Game page - should show at /ins-001/)
      └── join/
          └── [token].astro    (Join page - should show at /ins-001/join/[token])
```

Verify with:
```bash
git ls-files ins-001/web/src/pages/
```

## Next Steps

1. ✅ Check Root Directory setting (MOST IMPORTANT)
2. ✅ Clear build cache
3. ✅ Redeploy without cache
4. ✅ Check for red/blue/green banners
5. ✅ Report back which banners appear (or don't)
