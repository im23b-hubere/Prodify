from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.contracts.billing import BillingSyncBody, EntitlementPublic
from app.models import User, UserSubscription, utcnow
from app.services.kpi_tracker import track_event


def is_revenuecat_secret_configured(secret: str | None) -> bool:
    candidate = (secret or "").strip()
    if not candidate:
        return False
    lowered = candidate.lower()
    if lowered in {"your-rc-api-key", "changeme", "change-me"}:
        return False
    if lowered.startswith("your-"):
        return False
    if "..." in candidate:
        return False
    return True


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
    if not is_revenuecat_secret_configured(settings.revenuecat_secret_key):
        # Never trust client-asserted entitlements on public / staging hosts.
        if settings.environment != "development":
            raise ValueError("RevenueCat secret is required when ENVIRONMENT is not development")
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
    return BillingVerificationResult(
        app_user_id=body.app_user_id,
        entitlement="premium" if still_active else "free",
        trial_active=False,
        expires_at=expires_at if still_active else None,
        verification_source="revenuecat_api",
    )


def verify_billing_sync(body: BillingSyncBody) -> BillingVerificationResult:
    return _verification_from_revenuecat(body)


def save_verified_subscription(
    db: Session,
    user: User,
    verified: BillingVerificationResult,
) -> EntitlementPublic:
    verified_body = BillingSyncBody(
        app_user_id=verified.app_user_id,
        entitlement="premium" if verified.entitlement == "premium" else "free",
        trial_active=verified.trial_active,
        expires_at=verified.expires_at,
    )
    row = upsert_subscription(db, user.id, verified_body)
    apply_subscription_to_user(user, row)
    track_event(
        db,
        "trial_started" if verified_body.trial_active else "billing_sync",
        user.id,
        {
            "entitlement": verified_body.entitlement,
            "verified_by": verified.verification_source,
        },
    )
    db.commit()
    db.refresh(row)
    return to_entitlement_public(row)


def sync_from_webhook_payload(db: Session, payload: dict) -> tuple[int | None, UserSubscription | None]:
    event = _webhook_event(payload)
    user_id_raw = event.get("app_user_id") or event.get("user_id")
    if user_id_raw is None:
        return None, None
    user_id = _resolve_webhook_user_id(db, user_id_raw)
    if user_id is None:
        return None, None
    body = BillingSyncBody(
        app_user_id=str(user_id_raw),
        entitlement=_webhook_entitlement(event),
        trial_active=False,
        expires_at=_webhook_expiration(event),
    )
    return user_id, upsert_subscription(db, user_id, body)


def process_webhook_payload(db: Session, payload: dict) -> UserSubscription | None:
    user_id, row = sync_from_webhook_payload(db, payload)
    if row is None:
        return None

    if user_id is not None:
        user = db.get(User, user_id)
        if user is not None:
            apply_subscription_to_user(user, row)
    track_event(
        db,
        "trial_converted_paid"
        if row.entitlement == "premium" and not bool(row.trial_active)
        else "billing_webhook",
        user_id,
        {"entitlement": row.entitlement},
    )
    db.commit()
    return row


def apply_subscription_to_user(user: User, subscription: UserSubscription) -> None:
    user.is_premium = (
        1 if subscription.entitlement == "premium" or bool(subscription.trial_active) else 0
    )
    user.premium_until = subscription.expires_at


def _webhook_event(payload: dict) -> dict:
    nested_event = payload.get("event")
    return nested_event if isinstance(nested_event, dict) else payload


def _resolve_webhook_user_id(db: Session, raw_user_id: object) -> int | None:
    try:
        return int(str(raw_user_id))
    except ValueError:
        existing = db.scalar(
            select(UserSubscription).where(UserSubscription.rc_app_user_id == str(raw_user_id))
        )
        return int(existing.user_id) if existing is not None else None


def _webhook_entitlement(event: dict) -> str:
    event_type = str(event.get("type") or "").strip().upper()
    is_trial_period = bool(event.get("is_trial_period"))
    if "CANCELLATION" in event_type or "EXPIRATION" in event_type:
        return "free"
    if not is_trial_period and (
        "PURCHASE" in event_type or "RENEWAL" in event_type or bool(event.get("is_active"))
    ):
        return "premium"
    # Unknown and trial events must never accidentally grant premium access.
    return "free"


def _webhook_expiration(event: dict) -> datetime | None:
    expires = event.get("expires_at") or event.get("expiration_at_ms")
    if isinstance(expires, str):
        try:
            return datetime.fromisoformat(expires.replace("Z", "+00:00"))
        except ValueError:
            return None
    if isinstance(expires, (int, float)):
        try:
            return datetime.fromtimestamp(float(expires) / 1000.0, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    return None


def to_entitlement_public(row: UserSubscription | None) -> EntitlementPublic:
    if row is None:
        return EntitlementPublic()
    return EntitlementPublic(
        provider=row.provider,
        entitlement="premium" if row.entitlement == "premium" else "free",
        trial_active=bool(row.trial_active),
        expires_at=row.expires_at,
    )
