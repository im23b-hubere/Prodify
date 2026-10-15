from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import PushToken, utcnow
from app.contracts.notifications import PushBulkResultPublic, PushPingBody, PushTokenRegister
from app.services import push_templates
from app.services.push_dispatch import send_ping
from app.services.push_links import push_data_dashboard


def register_token(db: Session, user_id: int, registration: PushTokenRegister) -> None:
    token = registration.token.strip()
    channel = registration.channel if registration.channel in ("expo", "fcm") else "expo"
    platform = registration.platform.strip()[:32] or "unknown"
    existing = _find_token(db, user_id, token, channel)
    if existing is not None:
        _reactivate(existing, platform)
        db.commit()
        return

    db.add(
        PushToken(
            user_id=user_id,
            token=token,
            platform=platform,
            channel=channel,
            is_active=1,
            created_at=utcnow(),
            last_used_at=utcnow(),
        )
    )
    try:
        db.commit()
    except IntegrityError as error:
        _recover_concurrent_registration(db, user_id, token, channel, platform, error)


def send_self_ping(
    settings: Settings,
    db: Session,
    user_id: int,
    request: PushPingBody,
) -> PushBulkResultPublic:
    title, body, data = _ping_content(request)
    attempted, delivered, message = send_ping(settings, db, user_id, title, body, data=data)
    db.commit()
    return PushBulkResultPublic(attempted=attempted, delivered_ok=delivered, message=message)


def _find_token(db: Session, user_id: int, token: str, channel: str) -> PushToken | None:
    return db.scalar(
        select(PushToken).where(
            PushToken.user_id == user_id,
            PushToken.token == token,
            PushToken.channel == channel,
        )
    )


def _reactivate(token: PushToken, platform: str) -> None:
    token.platform = platform
    token.is_active = 1
    token.last_used_at = utcnow()


def _recover_concurrent_registration(
    db: Session,
    user_id: int,
    token: str,
    channel: str,
    platform: str,
    original_error: IntegrityError,
) -> None:
    db.rollback()
    existing = _find_token(db, user_id, token, channel)
    if existing is None:
        raise original_error
    _reactivate(existing, platform)
    db.commit()


def _ping_content(request: PushPingBody) -> tuple[str, str, dict[str, str]]:
    if request.template == "session_demo":
        title, body = push_templates.session_demo()
        return title, body, {**push_data_dashboard(), "kind": "session_demo"}
    if request.template == "streak_demo":
        title, body = push_templates.streak_reminder(request.streak_days or 7)
        return title, body, {**push_data_dashboard(), "kind": "streak_demo"}
    default_title, default_body = push_templates.admin_ping_default()
    return (
        request.title or default_title,
        request.body or default_body,
        {**push_data_dashboard(), "kind": "test_ping"},
    )
