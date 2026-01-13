"""
Authentication Middleware - INS-001

!!! CRITICAL SECURITY WARNING !!!

DO NOT use SUPABASE_SERVICE_KEY in this file.
DO NOT initialize a global supabase client.

The service key BYPASSES ALL RLS POLICIES.
If you use it, any user can read/write any data.

This middleware creates a PER-REQUEST client using the USER'S JWT.
This ensures RLS policies are enforced.
"""

import os
from typing import Tuple
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

# ============================================
# CONFIGURATION
# ============================================

SUPABASE_URL = os.environ["SUPABASE_URL"]

# !!! USE ANON KEY, NOT SERVICE KEY !!!
# The anon key is safe to expose - RLS protects data
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]

# Service key is ONLY for background jobs (no user context)
# NEVER import this in route handlers
_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

security = HTTPBearer()


# ============================================
# REQUEST-SCOPED AUTH
# ============================================

async def get_authenticated_client(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Tuple[Client, dict]:
    """
    Create a Supabase client authenticated as the current user.
    
    Returns:
        Tuple of (supabase_client, user_dict)
        
    The client respects RLS policies because it uses the user's JWT,
    not the service key.
    
    Usage in routes:
        @router.get("/games/{game_id}")
        async def get_game(game_id: str, auth = Depends(get_authenticated_client)):
            supabase, user = auth
            # This query is filtered by RLS - only returns user's games
            result = supabase.table("games").select("*").eq("id", game_id).execute()
    """
    import json
    import os
    log_path = "/Users/vishal/Documents/GitHub/phronos-instruments/.cursor/debug.log"
    # #region agent log
    try:
        with open(log_path, "a") as f:
            f.write(json.dumps({"location":"auth.py:43","message":"get_authenticated_client entry","data":{"hasCredentials":bool(credentials),"scheme":credentials.scheme if credentials else None},"timestamp":int(__import__("time").time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"G"})+"\n")
    except: pass
    # #endregion
    # Create fresh client with anon key
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    # Set the user's JWT - THIS IS WHAT MAKES RLS WORK
    # The JWT is verified by Supabase and auth.uid() returns this user
    token = credentials.credentials
    
    # #region agent log
    try:
        with open(log_path, "a") as f:
            f.write(json.dumps({"location":"auth.py:67","message":"Token extracted","data":{"hasToken":bool(token),"tokenLength":len(token) if token else 0,"tokenPrefix":token[:20] if token else None},"timestamp":int(__import__("time").time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"G"})+"\n")
    except: pass
    # #endregion
    
    try:
        # #region agent log
        try:
            with open(log_path, "a") as f:
                f.write(json.dumps({"location":"auth.py:70","message":"Before set_session","data":{},"timestamp":int(__import__("time").time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"H"})+"\n")
        except: pass
        # #endregion
        # This verifies the JWT signature and returns user info
        # If token is invalid/expired, this raises an exception
        supabase.auth.set_session(token, "")
        # #region agent log
        try:
            with open(log_path, "a") as f:
                f.write(json.dumps({"location":"auth.py:73","message":"After set_session, before get_user","data":{},"timestamp":int(__import__("time").time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"H"})+"\n")
        except: pass
        # #endregion
        response = supabase.auth.get_user()
        
        # #region agent log
        try:
            with open(log_path, "a") as f:
                f.write(json.dumps({"location":"auth.py:74","message":"After get_user","data":{"hasUser":bool(response.user),"userId":response.user.id if response.user else None},"timestamp":int(__import__("time").time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"H"})+"\n")
        except: pass
        # #endregion
        
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        return supabase, {
            "id": response.user.id,
            "email": response.user.email,
            "is_anonymous": response.user.is_anonymous or False,
        }
        
    except Exception as e:
        # #region agent log
        try:
            with open(log_path, "a") as f:
                f.write(json.dumps({"location":"auth.py:84","message":"Auth exception caught","data":{"errorType":type(e).__name__,"errorMsg":str(e)},"timestamp":int(__import__("time").time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"H"})+"\n")
        except: pass
        # #endregion
        raise HTTPException(
            status_code=401, 
            detail=f"Authentication failed: {str(e)}"
        )


# ============================================
# OPTIONAL AUTH (for public endpoints)
# ============================================

async def get_optional_client(
    request: Request
) -> Tuple[Client, dict | None]:
    """
    Like get_authenticated_client, but doesn't require auth.
    Returns (client, None) if no token provided.
    
    Useful for endpoints that work differently for logged-in users.
    """
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        # No auth - return client with no user context
        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        return supabase, None
    
    token = auth_header.replace("Bearer ", "")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    
    try:
        return await get_authenticated_client(credentials)
    except HTTPException:
        # Invalid token - treat as unauthenticated
        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        return supabase, None


# ============================================
# BACKGROUND JOB CLIENT (service key)
# ============================================

def get_service_client() -> Client:
    """
    Get a client with service key for background jobs.
    
    !!! WARNING !!!
    This bypasses RLS. Only use for:
    - Profile computation jobs
    - Cleanup jobs
    - Backup jobs
    - Admin operations
    
    NEVER use in request handlers that access user data.
    """
    if not _SERVICE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_KEY not set")
    
    return create_client(SUPABASE_URL, _SERVICE_KEY)
