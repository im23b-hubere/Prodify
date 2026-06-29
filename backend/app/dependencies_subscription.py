from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserSubscription
from app.schemas import EntitlementPublic
from app.services.entitlements import EntitlementService
from app.services.subscription_service import to_entitlement_public


def resolve_effective_entitlement(user: User, db: Session) -> EntitlementPublic:
    """
    Single source of truth for billing + access checks.

    Order: legacy `users.is_premium` → stored subscription with premium entitlement.
    """
    row = db.scalar(select(UserSubscription).where(UserSubscription.user_id == user.id))

    if EntitlementService.is_premium(user):
        base = to_entitlement_public(row)
        return EntitlementPublic(
            provider=base.provider or "legacy",
            entitlement="premium",
            trial_active=False,
            expires_at=user.premium_until,
        )

    if row is not None:
        pub = to_entitlement_public(row)
        if pub.entitlement == "premium":
            return EntitlementPublic(
                provider=pub.provider,
                entitlement="premium",
                trial_active=False,
                expires_at=pub.expires_at,
            )
        return pub

    return EntitlementPublic()


def get_entitlement_for_user(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EntitlementPublic:
    return resolve_effective_entitlement(current, db)


def require_premium_or_trial(
    entitlement: Annotated[EntitlementPublic, Depends(get_entitlement_for_user)],
) -> EntitlementPublic:
    if entitlement.entitlement == "premium":
        return entitlement
    raise HTTPException(status_code=402, detail="Premium entitlement required")


def user_has_premium_access(db: Session, user: User) -> bool:
    ent = resolve_effective_entitlement(user, db)
    return ent.entitlement == "premium"
