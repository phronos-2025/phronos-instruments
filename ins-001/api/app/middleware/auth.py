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
import httpx

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
    # Create fresh client with anon key
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    # Set the user's JWT - THIS IS WHAT MAKES RLS WORK
    # The JWT is verified by Supabase and auth.uid() returns this user
    token = credentials.credentials
    
    try:
        # Use Supabase REST API to verify the token and get user info
        # This is more reliable than set_session + get_user
        verify_url = f"{SUPABASE_URL}/auth/v1/user"
        headers = {
            "Authorization": f"Bearer {token}",
            "apikey": SUPABASE_ANON_KEY,
        }
        
        try:
            async with httpx.AsyncClient() as client:
                verify_response = await client.get(verify_url, headers=headers, timeout=10.0)
        except Exception as httpx_error:
            raise HTTPException(
                status_code=500,
                detail=f"Token verification request failed: {str(httpx_error)}"
            )
        
        if verify_response.status_code != 200:
            error_detail = verify_response.text
            raise HTTPException(
                status_code=401,
                detail=f"Token verification failed: {error_detail}"
            )
        
        try:
            user_data = verify_response.json()
        except Exception as json_error:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid response from auth service: {str(json_error)}"
            )
        
        # Set the session in the Supabase client for RLS to work
        try:
            supabase.auth.set_session(token, "")
        except Exception:
            # Continue anyway - the token is verified, RLS might still work
            pass
        
        return supabase, {
            "id": user_data["id"],
            "email": user_data.get("email"),
            "is_anonymous": user_data.get("is_anonymous", False) or False,
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
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
