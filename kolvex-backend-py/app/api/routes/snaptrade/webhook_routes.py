"""
SnapTrade Webhook Routes
Endpoints for receiving real-time updates from SnapTrade webhooks
"""

import hmac
import hashlib
import logging
import asyncio
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from starlette import status as http_status
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime

from app.core.config import settings
from app.services.snaptrade import SnapTradeService, get_snaptrade_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook")


# ========== Webhook Payload Schemas ==========

class WebhookPayload(BaseModel):
    """Base webhook payload from SnapTrade"""
    type: str = Field(..., description="Event type")
    userId: str = Field(..., description="SnapTrade user ID")
    timestamp: Optional[str] = None
    # The payload can contain additional fields depending on the event type


class AccountHoldingsUpdatedPayload(BaseModel):
    """Payload for ACCOUNT_HOLDINGS_UPDATED event"""
    type: str = "ACCOUNT_HOLDINGS_UPDATED"
    userId: str
    accountId: Optional[str] = None
    timestamp: Optional[str] = None


# ========== Webhook Verification ==========

def verify_webhook_signature(
    payload: bytes,
    signature: Optional[str],
    secret: str,
) -> bool:
    """
    Verify the webhook signature using HMAC-SHA256
    
    SnapTrade sends a signature in the header that we can verify using
    the webhook secret configured in their dashboard.
    
    Args:
        payload: Raw request body
        signature: Signature from request header
        secret: Webhook secret from SnapTrade dashboard
    
    Returns:
        True if signature is valid, False otherwise
    """
    if not signature or not secret:
        return False
    
    try:
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        # Compare signatures (constant time comparison to prevent timing attacks)
        return hmac.compare_digest(signature, expected_signature)
    except Exception as e:
        logger.error(f"Signature verification failed: {e}")
        return False


# ========== Webhook Handler ==========

async def process_holdings_update(
    snaptrade_user_id: str,
    account_id: Optional[str] = None,
):
    """
    Background task to process holdings update
    
    This runs asynchronously after we've acknowledged the webhook
    to avoid timeout issues.
    """
    try:
        service = get_snaptrade_service()
        
        # Find the Kolvex user by their SnapTrade user ID
        result = (
            service.supabase.table("snaptrade_connections")
            .select("user_id")
            .eq("snaptrade_user_id", snaptrade_user_id)
            .execute()
        )
        
        if not result.data or len(result.data) == 0:
            logger.warning(f"No user found for SnapTrade user ID: {snaptrade_user_id}")
            return
        
        user_id = result.data[0]["user_id"]
        logger.info(f"Processing holdings update for user {user_id} (SnapTrade: {snaptrade_user_id})")
        
        # Sync accounts first to ensure we have the latest account info
        try:
            await service.sync_accounts(user_id)
        except Exception as e:
            logger.warning(f"Failed to sync accounts: {e}")
        
        # Sync positions
        await service.sync_positions(user_id)
        
        logger.info(f"Successfully synced holdings for user {user_id}")
        
    except Exception as e:
        logger.error(f"Failed to process holdings update for {snaptrade_user_id}: {e}")


# ========== Webhook Endpoint ==========

@router.post("", status_code=http_status.HTTP_200_OK)
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Receive webhook events from SnapTrade
    
    This endpoint receives real-time updates when user portfolio data changes.
    Supported event types:
    - ACCOUNT_HOLDINGS_UPDATED: Triggered when positions, balances, or account value changes
    - ACCOUNT_TRANSACTIONS_INITIAL_UPDATE: Triggered when initial sync completes
    - BROKERAGE_AUTHORIZATION_DELETED: Triggered when user disconnects broker
    
    The endpoint immediately returns 200 OK and processes the event in the background
    to avoid timeout issues.
    """
    # Get raw body for signature verification
    body = await request.body()
    
    # Get signature from header (SnapTrade uses x-signature header)
    signature = request.headers.get("x-signature") or request.headers.get("X-Signature")
    
    # Verify signature if webhook secret is configured
    webhook_secret = settings.SNAPTRADE_WEBHOOK_SECRET
    if webhook_secret:
        if not verify_webhook_signature(body, signature, webhook_secret):
            logger.warning("Invalid webhook signature received")
            # Return 200 anyway to prevent SnapTrade from retrying
            # but log the issue for monitoring
            return {"status": "received", "verified": False}
    else:
        logger.warning("SNAPTRADE_WEBHOOK_SECRET not configured - skipping signature verification")
    
    # Parse the payload
    try:
        import json
        payload = json.loads(body)
    except Exception as e:
        logger.error(f"Failed to parse webhook payload: {e}")
        return {"status": "received", "error": "Invalid JSON"}
    
    event_type = payload.get("type", "UNKNOWN")
    snaptrade_user_id = payload.get("userId")
    account_id = payload.get("accountId")
    
    logger.info(f"Received webhook event: {event_type} for user {snaptrade_user_id}")
    
    # Handle different event types
    if event_type in [
        "ACCOUNT_HOLDINGS_UPDATED",
        "ACCOUNT_TRANSACTIONS_INITIAL_UPDATE",
        "TRANSACTIONS_UPDATED",
    ]:
        if snaptrade_user_id:
            # Process in background to return quickly
            background_tasks.add_task(
                process_holdings_update,
                snaptrade_user_id,
                account_id,
            )
            logger.info(f"Scheduled background sync for {snaptrade_user_id}")
    
    elif event_type == "BROKERAGE_AUTHORIZATION_DELETED":
        # User disconnected their broker - update our connection status
        if snaptrade_user_id:
            try:
                service = get_snaptrade_service()
                result = (
                    service.supabase.table("snaptrade_connections")
                    .update({"is_connected": False})
                    .eq("snaptrade_user_id", snaptrade_user_id)
                    .execute()
                )
                logger.info(f"Marked connection as disconnected for {snaptrade_user_id}")
            except Exception as e:
                logger.error(f"Failed to update connection status: {e}")
    
    else:
        logger.info(f"Unhandled webhook event type: {event_type}")
    
    # Always return 200 to acknowledge receipt
    return {
        "status": "received",
        "event_type": event_type,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/health")
async def webhook_health():
    """
    Health check endpoint for webhook receiver
    
    SnapTrade may ping this endpoint to verify the webhook URL is valid.
    """
    return {
        "status": "healthy",
        "service": "snaptrade-webhook",
        "timestamp": datetime.utcnow().isoformat(),
    }
