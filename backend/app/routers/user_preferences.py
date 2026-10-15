"""Device-reported settings that change how the server interprets a user's data."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.contracts.auth import UserTimezonePublic, UserTimezoneUpdate
from app.contracts.notifications import NotificationPreferencesPublic, NotificationPreferencesUpdate
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services.engagement.preferences import load_preferences, preferences_public, save_preferences

router = APIRouter()


@router.put("/me/timezone", response_model=UserTimezonePublic)
def set_my_timezone(
    payload: UserTimezoneUpdate,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserTimezonePublic:
    """
    Store the device's IANA timezone so streak days, check-ins and weekly goals roll over
    at the user's own midnight. Clients send this on sign-in and whenever the zone changes.
    """
    if current.timezone != payload.timezone:
        current.timezone = payload.timezone
        db.commit()
    return UserTimezonePublic(timezone=payload.timezone)


@router.get("/me/notification-preferences", response_model=NotificationPreferencesPublic)
def get_my_notification_preferences(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> NotificationPreferencesPublic:
    return preferences_public(load_preferences(db, current.id))


@router.put("/me/notification-preferences", response_model=NotificationPreferencesPublic)
def set_my_notification_preferences(
    payload: NotificationPreferencesUpdate,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> NotificationPreferencesPublic:
    """Every server push checks these before it is sent."""
    prefs = save_preferences(db, current.id, payload)
    db.commit()
    return preferences_public(prefs)
