"""Notification inbox and read-state endpoints."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.contracts.notifications import NotificationInboxItemPublic, NotificationInboxReadBody
from app.services.notification_inbox_service import build_notification_inbox, mark_inbox_read

router = APIRouter()


def _parse_epoch_ms(value: int | None, *, field_name: str) -> datetime | None:
    if not isinstance(value, int) or value <= 0:
        return None
    try:
        return datetime.fromtimestamp(value / 1000.0, tz=timezone.utc)
    except (OverflowError, OSError, ValueError):
        raise HTTPException(status_code=422, detail=f"Invalid timestamp for {field_name}")


@router.get("/inbox", response_model=list[NotificationInboxItemPublic])
def inbox_feed(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 40,
    since_ms: int | None = None,
):
    since_dt = _parse_epoch_ms(since_ms, field_name="since_ms")
    return build_notification_inbox(db, current.id, limit, since_dt)


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_notifications_read(
    body: NotificationInboxReadBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    target = _parse_epoch_ms(body.up_to_ms, field_name="up_to_ms")
    mark_inbox_read(db, current.id, target)
    return None
