"""Behaviour signals the app reports so the engagement engine can learn from them."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.contracts.notifications import NotificationPermissionBody
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, utcnow
from app.services.engagement.deliveries import record_app_open
from app.services.engagement.preferences import record_notification_permission

router = APIRouter(prefix="/engagement", tags=["engagement"])


@router.post("/app-open", status_code=status.HTTP_204_NO_CONTENT)
def report_app_open(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    """Sent when the app comes to the foreground; counted at most once per half hour."""
    record_app_open(db, current.id, utcnow())
    db.commit()


@router.post("/notification-permission", status_code=status.HTTP_204_NO_CONTENT)
def report_notification_permission(
    payload: NotificationPermissionBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    """Sent with the device's notification permission when the app starts."""
    record_notification_permission(db, current.id, granted=payload.granted, now=utcnow())
    db.commit()
