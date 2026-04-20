from typing import Annotated



from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy import select

from sqlalchemy.orm import Session



from app.config import settings

from app.database import get_db

from app.dependencies import get_current_user

from app.models import PushToken, User, utcnow

from app.schemas import PushBulkResultPublic, PushPingBody, PushTokenRegister

from app.services import push_templates

from app.services.push_links import push_data_dashboard
from app.services.push_dispatch import send_ping
from app.services.kpi_tracker import track_event



router = APIRouter(prefix="/notifications", tags=["notifications"])





@router.post("/register-token", status_code=status.HTTP_204_NO_CONTENT)

def register_push_token(

    body: PushTokenRegister,

    current: Annotated[User, Depends(get_current_user)],

    db: Annotated[Session, Depends(get_db)],

):
    if not settings.feature_flag_push_notifications_enabled:
        raise HTTPException(status_code=503, detail="Push notifications are temporarily disabled")

    token = body.token.strip()

    channel = body.channel if body.channel in ("expo", "fcm") else "expo"

    existing = db.scalar(

        select(PushToken).where(

            PushToken.user_id == current.id,

            PushToken.token == token,

            PushToken.channel == channel,

        )

    )

    if existing is not None:
        existing.platform = body.platform.strip()[:32] or "unknown"
        existing.is_active = 1
        existing.last_used_at = utcnow()
        db.add(existing)
        db.commit()
        return None

    db.add(

        PushToken(

            user_id=current.id,

            token=token,

            platform=body.platform.strip()[:32] or "unknown",

            channel=channel,
            is_active=1,

            created_at=utcnow(),
            last_used_at=utcnow(),

        )

    )

    db.commit()

    return None





@router.post("/ping-self", response_model=PushBulkResultPublic)

def ping_self_push(

    body: PushPingBody,

    current: Annotated[User, Depends(get_current_user)],

    db: Annotated[Session, Depends(get_db)],

):
    if not settings.feature_flag_push_notifications_enabled:
        raise HTTPException(status_code=503, detail="Push notifications are temporarily disabled")

    """Send a test push using Expo and/or FCM tokens for the current user."""

    ping_data: dict[str, str] | None = None

    if body.template == "session_demo":

        title, text = push_templates.session_demo()

        ping_data = {**push_data_dashboard(), "kind": "session_demo"}

    elif body.template == "streak_demo":

        title, text = push_templates.streak_reminder(body.streak_days or 7)

        ping_data = {**push_data_dashboard(), "kind": "streak_demo"}

    else:

        d_title, d_body = push_templates.admin_ping_default()

        title = body.title or d_title

        text = body.body or d_body

        ping_data = {**push_data_dashboard(), "kind": "test_ping"}



    attempted, ok, msg = send_ping(settings, db, current.id, title, text, data=ping_data)

    if attempted == 0 and msg and "no push" in msg.lower():

        raise HTTPException(status_code=400, detail=msg)

    if attempted > 0 and ok == 0:

        raise HTTPException(status_code=503, detail=msg or "All push deliveries failed")

    return PushBulkResultPublic(attempted=attempted, delivered_ok=ok, message=msg)


@router.post("/smart-nudge", response_model=PushBulkResultPublic)
def smart_nudge(
    body: dict,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if not settings.feature_flag_push_notifications_enabled:
        raise HTTPException(status_code=503, detail="Push notifications are temporarily disabled")
    if not settings.feature_flag_smart_nudges_enabled:
        raise HTTPException(status_code=503, detail="Smart nudges are temporarily disabled")
    kind = str(body.get("kind") or "inactivity")
    if kind == "best_time":
        hour = int(body.get("hour") or 20)
        title, text = push_templates.best_time_nudge(hour)
    elif kind == "forecast_risk":
        rem = int(body.get("remaining_sessions") or 2)
        days = int(body.get("days_left") or 2)
        title, text = push_templates.forecast_risk_nudge(rem, days)
    else:
        days = int(body.get("days_inactive") or 3)
        title, text = push_templates.inactivity_nudge(days)

    attempted, ok, msg = send_ping(settings, db, current.id, title, text, data=push_data_dashboard())
    track_event(db, "smart_notification_sent", current.id, {"kind": kind, "attempted": attempted, "delivered": ok})
    db.commit()
    return PushBulkResultPublic(attempted=attempted, delivered_ok=ok, message=msg)


