"""
Participant Identity - INS-001

Replaces Supabase Auth. There are no accounts: a participant is a client-minted
UUID kept in localStorage, exactly as durable as the anonymous JWT it replaces
(62 of 67 historical users were anonymous and none ever set a display name).

The server HMACs the UUID with PARTICIPANT_SECRET and hands back a token. Both are
sent on every request. Verifying the HMAC means a client cannot forge or enumerate
participant ids it was not issued — without the server storing a session.

!!! THREAT MODEL !!!

The participant token is a bearer secret. Anyone holding it can read and write that
participant's games. The data is anonymous and the id is an unguessable UUIDv4, so
this is proportionate — but it is weaker than the RLS model it replaces, and it is
why the browser no longer holds any Supabase credential.

The service-key client below bypasses nothing, because there is no RLS left to
bypass: every table denies anon and authenticated outright. The key never leaves
Railway. Route handlers are now solely responsible for scoping queries by
participant_id — RLS will not catch a missing .eq() for you.
"""

from __future__ import annotations

import hmac
import uuid
from hashlib import sha256
from typing import Optional, Tuple

from fastapi import HTTPException, Request
from supabase import Client, create_client

from app.config import PARTICIPANT_SECRET, SUPABASE_SERVICE_KEY, SUPABASE_URL

HEADER_ID = "X-Participant-Id"
HEADER_TOKEN = "X-Participant-Token"

_client: Optional[Client] = None


def get_db() -> Client:
    """The single service-key client. Module-level: PostgREST is stateless."""
    global _client
    if _client is None:
        if not SUPABASE_SERVICE_KEY:
            raise RuntimeError("SUPABASE_SERVICE_KEY is not set")
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


def sign(participant_id: str) -> str:
    """HMAC-SHA256 of the id, hex-encoded."""
    return hmac.new(
        PARTICIPANT_SECRET.encode(), participant_id.encode(), sha256
    ).hexdigest()


def mint() -> dict:
    """Issue a fresh participant id and its token."""
    pid = str(uuid.uuid4())
    return {"participant_id": pid, "token": sign(pid)}


def verify(participant_id: str, token: str) -> bool:
    try:
        uuid.UUID(participant_id)
    except (ValueError, AttributeError, TypeError):
        return False
    return hmac.compare_digest(sign(participant_id), token or "")


async def get_participant(request: Request) -> Tuple[Client, str]:
    """Require a valid participant. Returns (db, participant_id)."""
    pid = request.headers.get(HEADER_ID)
    token = request.headers.get(HEADER_TOKEN)

    if not pid or not token:
        raise HTTPException(
            status_code=401,
            detail=f"Missing {HEADER_ID} / {HEADER_TOKEN}. "
                   f"Call POST /api/v1/participants to obtain one.",
        )
    if not verify(pid, token):
        raise HTTPException(status_code=401, detail="Invalid participant token")

    return get_db(), pid


async def get_optional_participant(request: Request) -> Tuple[Client, Optional[str]]:
    """Like get_participant, but anonymous callers get (db, None)."""
    pid = request.headers.get(HEADER_ID)
    token = request.headers.get(HEADER_TOKEN)
    if pid and token and verify(pid, token):
        return get_db(), pid
    return get_db(), None
