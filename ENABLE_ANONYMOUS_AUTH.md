# Enable Anonymous Authentication in Supabase

The "Initializing..." screen suggests anonymous authentication might not be enabled.

## Steps to Enable Anonymous Auth

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Scroll down to find **Anonymous** provider
4. **Enable** it (toggle switch)
5. Save changes

## Verify It's Working

After enabling, the frontend should:
- Sign in anonymously automatically
- Show the input form instead of "Initializing..."
- Allow you to create games

## Alternative: Skip Auth Check Temporarily

If you want to test without anonymous auth, you can temporarily remove the auth check, but this will cause API errors since the API requires authentication.

## Check Browser Console

Open DevTools (F12) → Console and look for:
- Any Supabase auth errors
- Network errors
- The actual error message

This will help identify if it's an auth issue or something else.
