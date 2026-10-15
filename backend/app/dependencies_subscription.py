from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.contracts.billing import EntitlementPublic
from app.models import User
from app.services.subscription_service import resolve_effective_entitlement


def get_entitlement_for_user(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EntitlementPublic:
    return resolve_effective_entitlement(current, db)


def require_subscriber(
    entitlement: Annotated[EntitlementPublic, Depends(get_entitlement_for_user)],
) -> EntitlementPublic:
    """Prodify is subscription-only.

    Auth, billing, legal, jobs, health, feature flags, and account deletion stay
    reachable without an entitlement so a signed-in user can subscribe, restore,
    or leave. Every other authenticated product route depends on this.
    """
    if entitlement.entitlement == "premium":
        return entitlement
    raise HTTPException(status_code=402, detail="Premium entitlement required")


def user_has_premium_access(db: Session, user: User) -> bool:
    ent = resolve_effective_entitlement(user, db)
    return ent.entitlement == "premium"
