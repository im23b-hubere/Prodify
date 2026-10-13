import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import User, UserSubscription

ENTITLEMENT_ID = "app_access"
RC_SECRET = "sk_test_revenuecat_secret"
WEBHOOK_AUTH = "Bearer test-revenuecat-webhook-auth"
WEBHOOK_SIGNING_SECRET = "test-revenuecat-signing-secret"


def in_days(days: float) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)


def rc_subscriber(
    expires_at: datetime | None,
    *,
    entitlement_id: str = ENTITLEMENT_ID,
    grace_period_expires_at: datetime | None = None,
) -> dict:
    """Shape of RevenueCat `GET /v1/subscribers/{app_user_id}` for one entitlement."""
    return {
        "subscriber": {
            "entitlements": {
                entitlement_id: {
                    "expires_date": _iso(expires_at),
                    "grace_period_expires_date": _iso(grace_period_expires_at),
                    "product_identifier": "prodify_weekly_access",
                    "purchase_date": _iso(in_days(-7)),
                }
            }
        }
    }


def rc_subscriber_without_entitlement() -> dict:
    return {"subscriber": {"entitlements": {}}}


def use_revenuecat(monkeypatch, subscribers: dict[str, dict]) -> list[str]:
    """Configure RevenueCat verification and serve subscribers from memory.

    Returns the list of app user ids RevenueCat was asked about, in call order.
    """
    requested: list[str] = []

    def fake_fetch(app_user_id: str) -> dict:
        requested.append(app_user_id)
        return subscribers.get(app_user_id, rc_subscriber_without_entitlement())

    monkeypatch.setattr("app.config.settings.revenuecat_secret_key", RC_SECRET)
    monkeypatch.setattr("app.config.settings.premium_entitlement_name", ENTITLEMENT_ID)
    monkeypatch.setattr(
        "app.services.subscription_service.fetch_revenuecat_subscriber", fake_fetch
    )
    return requested


def use_webhook_auth(monkeypatch) -> None:
    monkeypatch.setattr("app.config.settings.revenuecat_webhook_auth", WEBHOOK_AUTH)
    monkeypatch.setattr(
        "app.config.settings.revenuecat_webhook_signing_secret", WEBHOOK_SIGNING_SECRET
    )


def webhook_body(event: dict) -> bytes:
    return json.dumps({"api_version": "1.0", "event": event}).encode("utf-8")


def post_webhook(client, event: dict, headers: dict[str, str] | None = None):
    return client.post(
        "/billing/webhooks/revenuecat",
        content=webhook_body(event),
        headers={
            "Content-Type": "application/json",
            **({"Authorization": WEBHOOK_AUTH} if headers is None else headers),
        },
    )


def revenuecat_signature(
    raw_body: bytes,
    secret: str = WEBHOOK_SIGNING_SECRET,
    timestamp: int | None = None,
) -> str:
    signed_at = int(time.time()) if timestamp is None else timestamp
    digest = hmac.new(
        secret.encode("utf-8"), f"{signed_at}.".encode("utf-8") + raw_body, hashlib.sha256
    ).hexdigest()
    return f"t={signed_at},v1={digest}"


def user_id_of(client, headers: dict[str, str]) -> int:
    return int(client.get("/auth/me", headers=headers).json()["id"])


def store_subscription(
    user_id: int,
    *,
    provider: str,
    entitlement: str,
    expires_at: datetime | None,
) -> None:
    with SessionLocal() as db:
        user = db.get(User, user_id)
        assert user is not None
        db.add(
            UserSubscription(
                user_id=user_id,
                provider=provider,
                entitlement=entitlement,
                trial_active=0,
                expires_at=expires_at,
                rc_app_user_id=str(user_id),
            )
        )
        user.is_premium = 1 if entitlement == "premium" else 0
        user.premium_until = expires_at
        db.commit()


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
