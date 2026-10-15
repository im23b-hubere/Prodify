"""Behaviour signals the app reports so the engagement engine can learn from them."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.contracts.engagement import EngagementDebugPublic
from app.contracts.notifications import NotificationPermissionBody
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, utcnow
from app.services.engagement.debug import engagement_debug
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


@router.get("/debug", response_model=EngagementDebugPublic)
def get_engagement_debug(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EngagementDebugPublic:
    """Development only: the engine's dry-run decision for the signed-in producer."""
    if settings.environment == "production":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return engagement_debug(db, current.id, utcnow())


@router.post("/notification-permission", status_code=status.HTTP_204_NO_CONTENT)
def report_notification_permission(
    payload: NotificationPermissionBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    """Sent with the device's notification permission when the app starts."""
    record_notification_permission(db, current.id, granted=payload.granted, now=utcnow())
    db.commit()
