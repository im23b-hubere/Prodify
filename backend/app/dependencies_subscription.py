from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserSubscription
from app.schemas import EntitlementPublic
from app.services.entitlements import EntitlementService


def get_entitlement_for_user(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EntitlementPublic:
    row = db.scalar(select(UserSubscription).where(UserSubscription.user_id == current.id))
    if row is None:
        return EntitlementPublic()
    return EntitlementPublic(
        provider=row.provider,
        entitlement="premium" if row.entitlement == "premium" else "free",
        trial_active=bool(row.trial_active),
        expires_at=row.expires_at,
    )


def require_premium_or_trial(
    entitlement: Annotated[EntitlementPublic, Depends(get_entitlement_for_user)],
) -> EntitlementPublic:
    if entitlement.entitlement == "premium" or entitlement.trial_active:
        return entitlement
    raise HTTPException(status_code=402, detail="Premium entitlement required")


def user_has_premium_access(db: Session, user: User) -> bool:
    if EntitlementService.is_premium(user):
        return True
    row = db.scalar(select(UserSubscription).where(UserSubscription.user_id == user.id))
    if row is None:
        return False
    return row.entitlement == "premium" or bool(row.trial_active)
