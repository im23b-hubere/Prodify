import hashlib
import hmac
import json
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.contracts.billing import BillingSyncBody, EntitlementPublic
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.dependencies_subscription import resolve_effective_entitlement
from app.services.subscription_service import (
    is_revenuecat_secret_configured,
    process_webhook_payload,
    save_verified_subscription,
    verify_billing_sync,
)

router = APIRouter(prefix="/billing", tags=["billing"])


def _verify_webhook_signature(signature: str | None, payload: bytes, secret: str) -> bool:
    if not signature:
        return False
    expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    expected_with_prefix = f"sha256={expected}"
    provided = signature.strip()
    return hmac.compare_digest(provided, expected) or hmac.compare_digest(provided, expected_with_prefix)


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
    signature: str | None = Header(default=None, alias="X-Webhook-Signature"),
):
    if not settings.feature_flag_billing_sync_enabled:
        raise HTTPException(status_code=503, detail="Billing sync is temporarily disabled")
    raw_payload = await request.body()
    if not _verify_webhook_signature(signature, raw_payload, settings.webhook_secret):
        raise HTTPException(status_code=403, detail="Invalid webhook signature")
    try:
        payload = json.loads(raw_payload.decode("utf-8") or "{}")
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON body") from None
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Unsupported webhook payload")
    row = process_webhook_payload(db, payload)
    if row is None:
        raise HTTPException(status_code=400, detail="Unsupported webhook payload")
    return None
