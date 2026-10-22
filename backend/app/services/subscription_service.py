"""Subscription state: RevenueCat is the source of truth for purchases.

Access granted outside RevenueCat (manual review accounts, screenshot seeds, legacy
`users.is_premium` flags) is never revoked or replaced by RevenueCat while it is still valid.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.contracts.billing import BillingSyncBody, EntitlementPublic
from app.models import User, UserSubscription, utcnow
from app.services.entitlements import EntitlementService
from app.services.kpi_tracker import track_event

REVENUECAT_PROVIDER = "revenuecat"


class RevenueCatNotConfiguredError(Exception):
    """Raised when RevenueCat must be asked for the subscription state but no secret is set."""


@dataclass(frozen=True)
class BillingVerificationResult:
    app_user_id: str
    entitlement: str
    trial_active: bool
    expires_at: datetime | None
    verification_source: str


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


# --- Effective access ------------------------------------------------------------------------


def resolve_effective_entitlement(user: User, db: Session) -> EntitlementPublic:
    """Single source of truth for billing + access checks."""
    row = _subscription_row(db, user.id)
    if EntitlementService.is_premium(user):
        return EntitlementPublic(
            provider=row.provider if row is not None else "legacy",
            entitlement="premium",
            expires_at=user.premium_until,
        )
    if row is not None and _is_live_premium(row):
        return EntitlementPublic(
            provider=row.provider,
            entitlement="premium",
            expires_at=row.expires_at,
        )
    if row is not None:
        return EntitlementPublic(provider=row.provider, entitlement="inactive")
    return EntitlementPublic()


def to_entitlement_public(row: UserSubscription | None) -> EntitlementPublic:
    if row is None:
        return EntitlementPublic()
    return EntitlementPublic(
        provider=row.provider,
        entitlement="premium" if row.entitlement == "premium" else "inactive",
        trial_active=bool(row.trial_active),
        expires_at=row.expires_at,
    )


# --- Verification ----------------------------------------------------------------------------


class RevenueCatDeletionError(Exception):
    """The subscriber could not be removed from RevenueCat, so the account stays."""


def delete_revenuecat_subscriber(app_user_id: str) -> None:
    """Remove the RevenueCat customer. Does not cancel the store subscription."""
    if not is_revenuecat_secret_configured(settings.revenuecat_secret_key):
        return
    try:
        response = requests.delete(
            f"https://api.revenuecat.com/v1/subscribers/{quote(app_user_id, safe='')}",
            headers={
                "Authorization": f"Bearer {settings.revenuecat_secret_key}",
                "Accept": "application/json",
            },
            timeout=8,
        )
    except requests.RequestException as exc:
        raise RevenueCatDeletionError("RevenueCat subscriber could not be deleted") from exc
    if response.status_code == 404:
        return
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise RevenueCatDeletionError("RevenueCat subscriber could not be deleted") from exc


def fetch_revenuecat_subscriber(app_user_id: str) -> dict:
    response = requests.get(
        f"https://api.revenuecat.com/v1/subscribers/{quote(app_user_id, safe='')}",
        headers={
            "Authorization": f"Bearer {settings.revenuecat_secret_key}",
            "Accept": "application/json",
        },
        timeout=8,
    )
    response.raise_for_status()
    payload = response.json()
    return payload if isinstance(payload, dict) else {}


def verify_billing_sync(body: BillingSyncBody) -> BillingVerificationResult:
    if is_revenuecat_secret_configured(settings.revenuecat_secret_key):
        return verify_with_revenuecat(body.app_user_id)
    # Never trust client-asserted entitlements on public / staging hosts.
    if settings.environment != "development":
        raise ValueError("RevenueCat secret is required when ENVIRONMENT is not development")
    return BillingVerificationResult(
        app_user_id=body.app_user_id,
        entitlement=body.entitlement,
        trial_active=body.trial_active,
        expires_at=body.expires_at,
        verification_source="client_asserted",
    )


def verify_with_revenuecat(app_user_id: str) -> BillingVerificationResult:
    payload = fetch_revenuecat_subscriber(app_user_id)
    is_active, access_until = _entitlement_access(
        payload, settings.premium_entitlement_name, datetime.now(timezone.utc)
    )
    return BillingVerificationResult(
        app_user_id=app_user_id,
        entitlement="premium" if is_active else "inactive",
        trial_active=False,
        expires_at=access_until if is_active else None,
        verification_source="revenuecat_api",
    )


def _entitlement_access(
    payload: dict, entitlement_id: str, now: datetime
) -> tuple[bool, datetime | None]:
    """(is_active, access_until) for one entitlement; a billing grace period extends access."""
    subscriber = payload.get("subscriber")
    entitlements = subscriber.get("entitlements") if isinstance(subscriber, dict) else None
    entitlement = entitlements.get(entitlement_id) if isinstance(entitlements, dict) else None
    if not isinstance(entitlement, dict):
        return False, None

    expires_at = _parse_iso_datetime(entitlement.get("expires_date"))
    if expires_at is None:
        return True, None
    grace_until = _parse_iso_datetime(entitlement.get("grace_period_expires_date"))
    access_until = max(expires_at, grace_until) if grace_until is not None else expires_at
    return access_until > now, access_until


# --- Persistence -----------------------------------------------------------------------------


def save_verified_subscription(
    db: Session,
    user: User,
    verified: BillingVerificationResult,
    event_name: str = "billing_sync",
) -> EntitlementPublic:
    row = _subscription_row(db, user.id)
    if _has_access_granted_outside_revenuecat(user, row):
        return resolve_effective_entitlement(user, db)

    if row is None:
        row = UserSubscription(user_id=user.id)
        db.add(row)
    row.provider = REVENUECAT_PROVIDER
    row.entitlement = "premium" if verified.entitlement == "premium" else "inactive"
    row.trial_active = 1 if verified.trial_active else 0
    row.expires_at = verified.expires_at
    row.rc_app_user_id = verified.app_user_id
    row.updated_at = utcnow()
    apply_subscription_to_user(user, row)
    track_event(
        db,
        event_name,
        user.id,
        {"entitlement": row.entitlement, "verified_by": verified.verification_source},
    )
    db.commit()
    db.refresh(row)
    return to_entitlement_public(row)


def apply_subscription_to_user(user: User, subscription: UserSubscription) -> None:
    user.is_premium = (
        1 if subscription.entitlement == "premium" or bool(subscription.trial_active) else 0
    )
    user.premium_until = subscription.expires_at


def _has_access_granted_outside_revenuecat(user: User, row: UserSubscription | None) -> bool:
    if row is None:
        return EntitlementService.is_premium(user)
    return row.provider != REVENUECAT_PROVIDER and _is_live_premium(row)


# --- Webhooks --------------------------------------------------------------------------------

_EVENT_USER_ID_FIELDS = ("app_user_id", "original_app_user_id")
_EVENT_USER_ID_LIST_FIELDS = ("aliases", "transferred_from", "transferred_to")


def process_revenuecat_webhook(db: Session, payload: dict) -> list[int]:
    """Re-read every customer named in the event from RevenueCat; returns the synced user ids.

    Event types are deliberately not interpreted: RevenueCat recommends fetching the subscriber
    after any webhook, which also makes duplicate and out-of-order deliveries harmless.
    """
    if not is_revenuecat_secret_configured(settings.revenuecat_secret_key):
        raise RevenueCatNotConfiguredError("RevenueCat secret is not configured")

    nested_event = payload.get("event")
    event = nested_event if isinstance(nested_event, dict) else payload
    synced_user_ids: list[int] = []
    for user in _users_named_in_event(db, event):
        verified = verify_with_revenuecat(str(user.id))
        save_verified_subscription(db, user, verified, event_name="billing_webhook")
        synced_user_ids.append(user.id)
    return synced_user_ids


def _users_named_in_event(db: Session, event: dict) -> list[User]:
    users: dict[int, User] = {}
    for app_user_id in _app_user_ids_in_event(event):
        user = _user_for_app_user_id(db, app_user_id)
        if user is not None:
            users.setdefault(user.id, user)
    return list(users.values())


def _app_user_ids_in_event(event: dict) -> list[str]:
    candidates: list[Any] = [event.get(field) for field in _EVENT_USER_ID_FIELDS]
    for field in _EVENT_USER_ID_LIST_FIELDS:
        values = event.get(field)
        if isinstance(values, list):
            candidates.extend(values)
    cleaned = (str(value).strip() for value in candidates if value is not None)
    return list(dict.fromkeys(value for value in cleaned if value))


def _user_for_app_user_id(db: Session, app_user_id: str) -> User | None:
    if app_user_id.isdigit():
        return db.get(User, int(app_user_id))
    row = db.scalar(
        select(UserSubscription).where(UserSubscription.rc_app_user_id == app_user_id)
    )
    return db.get(User, row.user_id) if row is not None else None


# --- Helpers ---------------------------------------------------------------------------------


def _subscription_row(db: Session, user_id: int) -> UserSubscription | None:
    return db.scalar(select(UserSubscription).where(UserSubscription.user_id == user_id))


def _is_live_premium(row: UserSubscription) -> bool:
    if row.entitlement != "premium":
        return False
    if row.expires_at is None:
        return True
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at > datetime.now(timezone.utc)


def _parse_iso_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)
