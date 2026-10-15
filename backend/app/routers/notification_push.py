"""Push-token registration and direct notification endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, utcnow
from app.contracts.notifications import PushBulkResultPublic, PushPingBody, PushTokenRegister
from app.services.engagement.deliveries import DeliveryNotFoundError, mark_opened
from app.services.push_notification_service import register_token, send_self_ping

router = APIRouter()


def _require_push_enabled() -> None:
    if not settings.feature_flag_push_notifications_enabled:
        raise HTTPException(status_code=503, detail="Push notifications are temporarily disabled")


@router.post("/register-token", status_code=status.HTTP_204_NO_CONTENT)
def register_push_token(
    body: PushTokenRegister,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    _require_push_enabled()
    register_token(db, current.id, body)


@router.post("/ping-self", response_model=PushBulkResultPublic)
def ping_self_push(
    body: PushPingBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> PushBulkResultPublic:
    _require_push_enabled()
    result = send_self_ping(settings, db, current.id, body)
    if result.attempted == 0 and result.message and "no push" in result.message.lower():
        raise HTTPException(status_code=400, detail=result.message)
    if result.attempted > 0 and result.delivered_ok == 0:
        raise HTTPException(status_code=503, detail=result.message or "All push deliveries failed")
    return result


@router.post("/{notification_id}/opened", status_code=status.HTTP_204_NO_CONTENT)
def report_notification_opened(
    notification_id: str,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    """The app reports a tap on a push (its `data.nid`); repeated reports are no-ops."""
    try:
        mark_opened(db, current.id, notification_id, utcnow())
    except DeliveryNotFoundError:
        raise HTTPException(status_code=404, detail="Notification not found") from None
    db.commit()
