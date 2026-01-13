# Vercel Deployment Configuration

## Critical Settings

For this project to deploy correctly on Vercel, you **MUST** configure the following in your Vercel project settings:

### Root Directory
**Set to:** `ins-001/web`

**How to set:**
1. Go to Vercel Dashboard → Your Project → Settings
2. Navigate to "Build & Development Settings"
3. Set "Root Directory" to: `ins-001/web`
4. Save and redeploy

### Build Settings
- **Framework Preset:** Astro (auto-detected)
- **Build Command:** `npm run build` (auto-detected)
- **Output Directory:** `.vercel/output` (auto-handled by Astro adapter)
- **Install Command:** `npm install` (auto-detected)

### Why This Matters

Without the correct root directory, Vercel will:
- Build from the repository root instead of `ins-001/web`
- Not find `package.json` or `astro.config.mjs`
- Fail to generate routes for nested directories like `ins-001/index.astro`
- Serve 404 errors for `/ins-001/` routes

## Verification

After setting the root directory and redeploying:
- `/` should show the landing page (with "LANDING-PAGE-v2.0" badge)
- `/ins-001/` should show the game (with "INSTRUMENT-LAYOUT-v2.0" badge)
- `/ins-001/join/[token]` should work for share links
