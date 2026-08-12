"""Push-token registration and direct notification endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.contracts.notifications import PushBulkResultPublic, PushPingBody, PushTokenRegister, SmartNudgeBody
from app.services.push_notification_service import register_token, send_self_ping, send_smart_nudge

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


@router.post("/smart-nudge", response_model=PushBulkResultPublic)
def smart_nudge(
    body: SmartNudgeBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> PushBulkResultPublic:
    _require_push_enabled()
    if not settings.feature_flag_smart_nudges_enabled:
        raise HTTPException(status_code=503, detail="Smart nudges are temporarily disabled")
    return send_smart_nudge(settings, db, current.id, body)
