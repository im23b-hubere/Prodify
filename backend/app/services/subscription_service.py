from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import UserSubscription, utcnow
from app.schemas import BillingSyncBody, EntitlementPublic


def upsert_subscription(db: Session, user_id: int, body: BillingSyncBody) -> UserSubscription:
    row = db.scalar(select(UserSubscription).where(UserSubscription.user_id == user_id))
    if row is None:
        row = UserSubscription(user_id=user_id)
        db.add(row)
    row.provider = "revenuecat"
    row.entitlement = body.entitlement
    row.trial_active = 1 if body.trial_active else 0
    row.expires_at = body.expires_at
    row.rc_app_user_id = body.app_user_id
    row.updated_at = utcnow()
    return row


@dataclass(frozen=True)
class BillingVerificationResult:
    app_user_id: str
    entitlement: str
    trial_active: bool
    expires_at: datetime | None
    verification_source: str


def _parse_iso_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def _verification_from_client_body(body: BillingSyncBody) -> BillingVerificationResult:
    return BillingVerificationResult(
        app_user_id=body.app_user_id,
        entitlement=body.entitlement,
        trial_active=body.trial_active,
        expires_at=body.expires_at,
        verification_source="client_asserted",
    )


def _verification_from_revenuecat(body: BillingSyncBody) -> BillingVerificationResult:
    if not settings.revenuecat_secret_key:
        return _verification_from_client_body(body)

    response = requests.get(
        f"https://api.revenuecat.com/v1/subscribers/{body.app_user_id}",
        headers={
            "Authorization": f"Bearer {settings.revenuecat_secret_key}",
            "Accept": "application/json",
        },
        timeout=8,
    )
    response.raise_for_status()
    parsed_payload = response.json()
    payload = parsed_payload if isinstance(parsed_payload, dict) else {}
    subscriber = payload.get("subscriber", {}) if isinstance(payload, dict) else {}
    entitlements = subscriber.get("entitlements", {}) if isinstance(subscriber, dict) else {}
    ent_key = settings.premium_entitlement_name
    active_ent = entitlements.get(ent_key) if isinstance(entitlements, dict) else None
    if not isinstance(active_ent, dict):
        return BillingVerificationResult(
            app_user_id=body.app_user_id,
            entitlement="free",
            trial_active=False,
            expires_at=None,
            verification_source="revenuecat_api",
        )

    expires_at = _parse_iso_datetime(active_ent.get("expires_date"))
    now = datetime.now(timezone.utc)
    still_active = expires_at is None or expires_at > now
    period_type = str(active_ent.get("period_type") or "").strip().lower()
    trial_active = still_active and period_type == "trial"
    return BillingVerificationResult(
        app_user_id=body.app_user_id,
        entitlement="premium" if still_active else "free",
        trial_active=trial_active,
        expires_at=expires_at,
        verification_source="revenuecat_api",
    )


def verify_billing_sync(body: BillingSyncBody) -> BillingVerificationResult:
    return _verification_from_revenuecat(body)


def sync_from_webhook_payload(db: Session, payload: dict) -> tuple[int | None, UserSubscription | None]:
    user_id_raw = payload.get("app_user_id") or payload.get("user_id")
    if user_id_raw is None:
        return None, None
    try:
        user_id = int(str(user_id_raw))
    except ValueError:
        return None, None
    ent = "premium" if bool(payload.get("is_active")) else "free"
    trial_active = bool(payload.get("is_trial_period"))
    expires = payload.get("expires_at")
    expires_at: datetime | None = None
    if isinstance(expires, str):
        try:
            expires_at = datetime.fromisoformat(expires.replace("Z", "+00:00"))
        except ValueError:
            expires_at = None
    body = BillingSyncBody(
        app_user_id=str(user_id_raw),
        entitlement=ent,
        trial_active=trial_active,
        expires_at=expires_at,
    )
    row = upsert_subscription(db, user_id, body)
    return user_id, row


def to_entitlement_public(row: UserSubscription | None) -> EntitlementPublic:
    if row is None:
        return EntitlementPublic()
    return EntitlementPublic(
        provider=row.provider,
        entitlement="premium" if row.entitlement == "premium" else "free",
        trial_active=bool(row.trial_active),
        expires_at=row.expires_at,
    )
