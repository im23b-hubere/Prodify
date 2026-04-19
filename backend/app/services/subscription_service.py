from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

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
