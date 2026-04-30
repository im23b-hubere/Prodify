from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserSubscription, utcnow
from app.schemas import EntitlementPublic
from app.services.entitlements import EntitlementService
from app.services.subscription_service import to_entitlement_public


def _onboarding_expires_at(user: User) -> datetime | None:
    days = int(settings.onboarding_trial_days or 0)
    if days <= 0:
        return None
    created = user.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return created + timedelta(days=days)


def within_onboarding_server_trial(user: User) -> bool:
    """True while the account is within the post-signup server trial window (no Store row required)."""
    days = int(settings.onboarding_trial_days or 0)
    if days <= 0:
        return False
    deadline = _onboarding_expires_at(user)
    if deadline is None:
        return False
    return utcnow() < deadline


def resolve_effective_entitlement(user: User, db: Session) -> EntitlementPublic:
    """
    Single source of truth for billing + access checks.

    Order: legacy `users.is_premium` → stored subscription (premium / trial) →
    server onboarding trial when subscription is missing or explicitly free without trial.
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

    onboarding = within_onboarding_server_trial(user)
    expires_at = _onboarding_expires_at(user) if onboarding else None

    if row is not None:
        pub = to_entitlement_public(row)
        if pub.entitlement == "premium" or pub.trial_active:
            return pub
        if onboarding:
            return EntitlementPublic(
                provider=pub.provider or "server",
                entitlement="free",
                trial_active=True,
                expires_at=expires_at,
            )
        return pub

    if onboarding:
        return EntitlementPublic(
            provider="server",
            entitlement="free",
            trial_active=True,
            expires_at=expires_at,
        )
    return EntitlementPublic()


def get_entitlement_for_user(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EntitlementPublic:
    return resolve_effective_entitlement(current, db)


def require_premium_or_trial(
    entitlement: Annotated[EntitlementPublic, Depends(get_entitlement_for_user)],
) -> EntitlementPublic:
    if entitlement.entitlement == "premium" or entitlement.trial_active:
        return entitlement
    raise HTTPException(status_code=402, detail="Premium entitlement required")


def user_has_premium_access(db: Session, user: User) -> bool:
    ent = resolve_effective_entitlement(user, db)
    return ent.entitlement == "premium" or bool(ent.trial_active)
