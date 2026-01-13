# Railway CORS Fix

## The Problem
Browser shows: "No 'Access-Control-Allow-Origin' header is present" even though CORS is configured in code.

## Root Cause
The Railway API needs to be **restarted** to pick up CORS configuration changes.

## The Fix

### Option 1: Restart Railway Service (Recommended)
1. Go to Railway Dashboard: https://railway.app
2. Select your project: `phronos-instruments-production`
3. Go to the service/deployment
4. Click **"Restart"** or **"Redeploy"**
5. Wait for deployment to complete (2-3 minutes)

### Option 2: Trigger Redeploy via Git
1. Make a small change to trigger redeploy:
   ```bash
   # Add a comment to main.py
   git commit --allow-empty -m "Trigger Railway redeploy for CORS"
   git push origin main
   ```
2. Railway will auto-deploy

## Verification

After restarting, test with:
```bash
curl -X OPTIONS -H "Origin: https://phronos-instruments.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -v https://phronos-instruments-production.up.railway.app/api/v1/games/ \
  2>&1 | grep -i "access-control-allow-origin"
```

Should show:
```
< access-control-allow-origin: https://phronos-instruments.vercel.app
```

## Current CORS Configuration

The code already includes:
```python
cors_origins = [
    "https://phronos-instruments.vercel.app",  # ✅ Already in code
    "https://instruments.phronos.org",
    # ... localhost for dev
]
```

The configuration is correct - Railway just needs to restart to apply it.
