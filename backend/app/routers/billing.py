import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.config import settings
from app.contracts.billing import BillingSyncBody, EntitlementPublic
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services.revenuecat_webhook_auth import SIGNATURE_HEADER, is_authentic_revenuecat_webhook
from app.services.subscription_service import (
    RevenueCatNotConfiguredError,
    is_revenuecat_secret_configured,
    process_revenuecat_webhook,
    resolve_effective_entitlement,
    save_verified_subscription,
    verify_billing_sync,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/entitlement", response_model=EntitlementPublic)
def get_entitlement(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return resolve_effective_entitlement(current, db)


@router.post("/sync", response_model=EntitlementPublic)
def sync_entitlement(
    body: BillingSyncBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if not settings.feature_flag_billing_sync_enabled:
        raise HTTPException(status_code=503, detail="Billing sync is temporarily disabled")
    if body.app_user_id != str(current.id):
        raise HTTPException(status_code=403, detail="app_user_id does not match authenticated user")
    if settings.environment == "production" and not is_revenuecat_secret_configured(settings.revenuecat_secret_key):
        raise HTTPException(status_code=503, detail="Billing verification is not configured")

    try:
        verified = verify_billing_sync(body)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception:
        raise HTTPException(status_code=502, detail="Could not verify purchase state with billing provider")
    return save_verified_subscription(db, current, verified)


@router.post("/webhooks/revenuecat", status_code=status.HTTP_204_NO_CONTENT)
async def revenuecat_webhook(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
):
    """Non-2xx responses make RevenueCat retry (5, 10, 20, 40, 80 minutes)."""
    if not settings.feature_flag_billing_sync_enabled:
        raise HTTPException(status_code=503, detail="Billing sync is temporarily disabled")
    raw_payload = await request.body()
    if not is_authentic_revenuecat_webhook(
        authorization=request.headers.get("Authorization"),
        signature=request.headers.get(SIGNATURE_HEADER),
        raw_body=raw_payload,
    ):
        raise HTTPException(status_code=403, detail="Invalid webhook signature")
    try:
        payload = json.loads(raw_payload.decode("utf-8") or "{}")
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON body") from None
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Unsupported webhook payload")

    try:
        await run_in_threadpool(process_revenuecat_webhook, db, payload)
    except RevenueCatNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail="Billing verification is not configured") from exc
    except Exception as exc:
        logger.exception("RevenueCat webhook could not be synced")
        raise HTTPException(
            status_code=502, detail="Could not verify purchase state with billing provider"
        ) from exc
    return None
