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



router = APIRouter(prefix="/notifications", tags=["notifications"])





@router.post("/register-token", status_code=status.HTTP_204_NO_CONTENT)

def register_push_token(

    body: PushTokenRegister,

    current: Annotated[User, Depends(get_current_user)],

    db: Annotated[Session, Depends(get_db)],

):

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

        return None

    db.add(

        PushToken(

            user_id=current.id,

            token=token,

            platform=body.platform.strip()[:32] or "unknown",

            channel=channel,

            created_at=utcnow(),

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


