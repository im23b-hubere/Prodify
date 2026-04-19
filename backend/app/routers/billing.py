import hashlib
import hmac
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
from app.services.subscription_service import sync_from_webhook_payload, to_entitlement_public, upsert_subscription

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
    if settings.environment == "production":
        raise HTTPException(status_code=403, detail="Client sync not allowed in production")
    row = upsert_subscription(db, current.id, body)
    current.is_premium = 1 if body.entitlement == "premium" or body.trial_active else 0
    current.premium_until = body.expires_at
    track_event(db, "trial_started" if body.trial_active else "billing_sync", current.id, {"entitlement": body.entitlement})
    db.commit()
    db.refresh(row)
    return to_entitlement_public(row)


@router.post("/webhooks/revenuecat", status_code=status.HTTP_204_NO_CONTENT)
async def revenuecat_webhook(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    signature: str | None = Header(default=None, alias="X-Webhook-Signature"),
):
    raw_payload = await request.body()
    if not _verify_webhook_signature(signature, raw_payload, settings.webhook_secret):
        raise HTTPException(status_code=403, detail="Invalid webhook signature")
    payload = await request.json()
    user_id, row = sync_from_webhook_payload(db, payload if isinstance(payload, dict) else {})
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
