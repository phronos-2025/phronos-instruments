"""
Participants Routes - INS-001

Replaces Supabase Auth sign-in. A participant is a client-minted UUID plus an
HMAC token; there is no account, no password, no email. The client stores both in
localStorage and sends them on every request (see middleware/participant.py).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.middleware.participant import get_participant, mint

router = APIRouter()


@router.post("/")
async def create_participant():
    """Mint a fresh participant id and token. Stateless — no database write."""
    return mint()


@router.get("/me")
async def whoami(auth=Depends(get_participant)):
    """Echo the caller's participant id if the token is valid (401 otherwise)."""
    _, participant_id = auth
    return {"participant_id": participant_id}
