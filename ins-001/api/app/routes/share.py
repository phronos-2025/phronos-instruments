"""
Share Routes - INS-001 Semantic Associations

Handles share token generation and join game flow.
"""

from fastapi import APIRouter, HTTPException, Depends
from app.models import (
    CreateShareTokenResponse,
    JoinGameResponse,
    NoiseFloorWord,
    ErrorResponse
)
from app.middleware.auth import get_authenticated_client
from app.config import FRONTEND_URL

router = APIRouter()


@router.post("/games/{game_id}/share", response_model=CreateShareTokenResponse)
async def create_share_token(
    game_id: str,
    auth = Depends(get_authenticated_client)
):
    """
    Generate a share token for a game.
    
    Only the sender can create share tokens.
    Game must be in 'pending_guess' status (clues submitted).
    """
    supabase, user = auth
    
    # Verify user owns the game and it's ready to share
    game_result = supabase.table("games") \
        .select("*") \
        .eq("id", game_id) \
        .eq("sender_id", user["id"]) \
        .eq("status", "pending_guess") \
        .single() \
        .execute()
    
    if not game_result.data:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "Game not found or not ready to share",
                "detail": "Game must be owned by you and have clues submitted"
            }
        )
    
    # Create share token
    token_result = supabase.table("share_tokens") \
        .insert({
            "game_id": game_id
        }) \
        .execute()
    
    if not token_result.data:
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to create share token"}
        )
    
    token = token_result.data[0]
    return CreateShareTokenResponse(
        token=token["token"],
        expires_at=token["expires_at"],
        share_url=f"{FRONTEND_URL}/join/{token['token']}"
    )


@router.post("/join/{token}", response_model=JoinGameResponse)
async def join_game(
    token: str,
    auth = Depends(get_authenticated_client)
):
    """
    Join a game via share token.
    
    This calls the SQL function which:
    - Validates token is active and not expired
    - Prevents self-play
    - Assigns recipient to game
    - Deactivates token (one-time use)
    - Returns game details (WITHOUT seed_word for security)
    """
    supabase, user = auth
    
    # Call SQL function (handles all validation and locking)
    result = supabase.rpc("join_game_via_token", {
        "share_token_input": token
    }).execute()
    
    if not result.data or len(result.data) == 0:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Failed to join game",
                "detail": "Token may be invalid, expired, or game already has a recipient"
            }
        )
    
    game_data = result.data[0]
    
    # Parse noise floor from JSONB
    noise_floor = [
        NoiseFloorWord(word=item["word"], similarity=item["similarity"])
        for item in game_data.get("noise_floor", [])
    ]
    
    return JoinGameResponse(
        game_id=str(game_data["game_id"]),
        clues=game_data["clues"] or [],
        noise_floor=noise_floor,
        sender_display_name=game_data.get("sender_display_name")
    )
