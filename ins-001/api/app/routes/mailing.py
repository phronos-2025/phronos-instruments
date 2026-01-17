"""
Mailing List Routes - Phronos

Handles email newsletter subscription and unsubscription.
Uses Resend for sending welcome emails.
"""

import re
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from postgrest.exceptions import APIError
from app.models import (
    SubscribeRequest,
    SubscribeResponse,
    UnsubscribeRequest,
    UnsubscribeResponse,
    SubscriptionStatusResponse,
)
from app.middleware.auth import get_optional_client
from app.config import RESEND_API_KEY, MAILING_FROM_EMAIL, FRONTEND_URL

router = APIRouter()

# Email validation regex
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


def validate_email(email: str) -> bool:
    """Validate email format."""
    return bool(EMAIL_REGEX.match(email))


async def send_welcome_email(email: str, unsubscribe_token: str) -> bool:
    """Send welcome email via Resend."""
    if not RESEND_API_KEY:
        print(f"RESEND_API_KEY not configured, skipping welcome email to {email}")
        return False

    try:
        import resend
        resend.api_key = RESEND_API_KEY

        unsubscribe_url = f"{FRONTEND_URL}/unsubscribe?token={unsubscribe_token}"

        resend.Emails.send({
            "from": MAILING_FROM_EMAIL,
            "to": email,
            "subject": "You're subscribed to Phronos updates",
            "html": f"""
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1A1A1A;">
                <h1 style="font-size: 24px; font-weight: 400; margin-bottom: 24px;">Welcome to Phronos</h1>

                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
                    You're now subscribed to receive updates about our work.
                </p>

                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
                    We'll send occasional emails about new dispatches, research findings, and instrument releases. No spam. Just signal.
                </p>

                <p style="font-size: 14px; color: #666; margin-top: 40px;">
                    <a href="{unsubscribe_url}" style="color: #666;">Unsubscribe</a>
                </p>
            </div>
            """,
            "headers": {
                "List-Unsubscribe": f"<{unsubscribe_url}>",
            }
        })
        return True
    except Exception as e:
        print(f"Failed to send welcome email to {email}: {e}")
        return False


@router.post("/subscribe", response_model=SubscribeResponse)
async def subscribe(
    request: SubscribeRequest,
    auth=Depends(get_optional_client)
):
    """
    Subscribe to the mailing list.

    - Validates email format
    - Creates subscription record
    - Links to auth.users if authenticated or email matches
    - Sends welcome email via Resend
    """
    supabase, user = auth

    email = request.email.lower().strip()

    # Validate email format
    if not validate_email(email):
        raise HTTPException(
            status_code=400,
            detail={"error": "Invalid email format"}
        )

    # Get user_id if authenticated
    user_id = user.get("id") if user else None

    try:
        # Check if already subscribed
        existing = supabase.table("mailing_list") \
            .select("id, is_active, unsubscribe_token, user_id") \
            .eq("email", email) \
            .maybe_single() \
            .execute()

        if existing.data:
            if existing.data.get("is_active"):
                # Already subscribed and active
                return SubscribeResponse(
                    success=True,
                    message="You're already subscribed!",
                    already_subscribed=True
                )
            else:
                # Reactivate subscription
                update_data = {
                    "is_active": True,
                    "updated_at": "now()"
                }
                # Link user if not already linked
                if user_id and not existing.data.get("user_id"):
                    update_data["user_id"] = user_id

                supabase.table("mailing_list") \
                    .update(update_data) \
                    .eq("id", existing.data["id"]) \
                    .execute()

                # Send welcome email
                await send_welcome_email(email, existing.data["unsubscribe_token"])

                return SubscribeResponse(
                    success=True,
                    message="Welcome back! You're subscribed again.",
                    already_subscribed=False
                )

        # New subscription
        insert_data = {
            "email": email,
            "source": request.source,
        }
        if user_id:
            insert_data["user_id"] = user_id

        result = supabase.table("mailing_list") \
            .insert(insert_data) \
            .execute()

        if result.data and len(result.data) > 0:
            unsubscribe_token = result.data[0].get("unsubscribe_token")

            # Send welcome email
            email_sent = await send_welcome_email(email, unsubscribe_token)

            # Update welcome_sent_at if email was sent
            if email_sent:
                supabase.table("mailing_list") \
                    .update({"welcome_sent_at": "now()"}) \
                    .eq("id", result.data[0]["id"]) \
                    .execute()

            return SubscribeResponse(
                success=True,
                message="You're subscribed! Check your email for confirmation.",
                already_subscribed=False
            )

        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to create subscription"}
        )

    except APIError as e:
        print(f"Supabase error in subscribe: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Database error", "detail": str(e)}
        )


@router.post("/unsubscribe", response_model=UnsubscribeResponse)
async def unsubscribe(request: UnsubscribeRequest):
    """
    Unsubscribe from the mailing list using token.

    This endpoint is public (no auth required) to allow
    one-click unsubscribe from email links.
    """
    from app.config import SUPABASE_URL, SUPABASE_ANON_KEY
    from supabase import create_client

    # Use anon client for public unsubscribe
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

    try:
        # Find subscription by token
        result = supabase.table("mailing_list") \
            .select("id, email, is_active") \
            .eq("unsubscribe_token", request.token) \
            .maybe_single() \
            .execute()

        if not result.data:
            raise HTTPException(
                status_code=404,
                detail={"error": "Invalid unsubscribe token"}
            )

        if not result.data.get("is_active"):
            return UnsubscribeResponse(
                success=True,
                message="You're already unsubscribed."
            )

        # Deactivate subscription
        supabase.table("mailing_list") \
            .update({
                "is_active": False,
                "updated_at": "now()"
            }) \
            .eq("id", result.data["id"]) \
            .execute()

        return UnsubscribeResponse(
            success=True,
            message="You've been unsubscribed. Sorry to see you go!"
        )

    except APIError as e:
        print(f"Supabase error in unsubscribe: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Database error", "detail": str(e)}
        )


@router.get("/status", response_model=SubscriptionStatusResponse)
async def get_subscription_status(
    auth=Depends(get_optional_client)
):
    """
    Get subscription status for authenticated user.

    Returns subscription status based on the user's email.
    """
    supabase, user = auth

    if not user or not user.get("email"):
        raise HTTPException(
            status_code=401,
            detail={"error": "Authentication required"}
        )

    email = user["email"].lower()

    try:
        result = supabase.table("mailing_list") \
            .select("email, is_active, subscribed_at") \
            .eq("email", email) \
            .maybe_single() \
            .execute()

        if not result.data:
            return SubscriptionStatusResponse(
                email=email,
                is_subscribed=False
            )

        return SubscriptionStatusResponse(
            email=email,
            is_subscribed=result.data.get("is_active", False),
            subscribed_at=result.data.get("subscribed_at")
        )

    except APIError as e:
        print(f"Supabase error in get_subscription_status: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Database error", "detail": str(e)}
        )
