import hashlib
import hmac
import json
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserSubscription
from app.schemas import BillingSyncBody, EntitlementPublic
from app.services.kpi_tracker import track_event
from app.services.subscription_service import (
    sync_from_webhook_payload,
    to_entitlement_public,
    upsert_subscription,
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
    row = db.scalar(select(UserSubscription).where(UserSubscription.user_id == current.id))
    return to_entitlement_public(row)


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
    if settings.environment == "production" and not settings.revenuecat_secret_key:
        raise HTTPException(status_code=503, detail="Billing verification is not configured")

    try:
        verified = verify_billing_sync(body)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception:
        raise HTTPException(status_code=502, detail="Could not verify purchase state with billing provider")

    verified_body = BillingSyncBody(
        app_user_id=verified.app_user_id,
        entitlement="premium" if verified.entitlement == "premium" else "free",
        trial_active=verified.trial_active,
        expires_at=verified.expires_at,
    )
    row = upsert_subscription(db, current.id, verified_body)
    current.is_premium = 1 if verified_body.entitlement == "premium" or verified_body.trial_active else 0
    current.premium_until = verified_body.expires_at
    track_event(
        db,
        "trial_started" if verified_body.trial_active else "billing_sync",
        current.id,
        {"entitlement": verified_body.entitlement, "verified_by": verified.verification_source},
    )
    db.commit()
    db.refresh(row)
    return to_entitlement_public(row)


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
    user_id, row = sync_from_webhook_payload(db, payload)
    if row is None:
        raise HTTPException(status_code=400, detail="Unsupported webhook payload")
    if user_id is not None:
        u = db.get(User, user_id)
        if u is not None:
            u.is_premium = 1 if row.entitlement == "premium" or bool(row.trial_active) else 0
            u.premium_until = row.expires_at
    track_event(
        db,
        "trial_converted_paid" if row.entitlement == "premium" and not bool(row.trial_active) else "billing_webhook",
        user_id,
        {"entitlement": row.entitlement},
    )
    db.commit()
    return None
