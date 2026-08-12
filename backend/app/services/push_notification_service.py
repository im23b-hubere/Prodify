from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import PushToken, utcnow
from app.contracts.notifications import PushBulkResultPublic, PushPingBody, PushTokenRegister, SmartNudgeBody
from app.services import push_templates
from app.services.kpi_tracker import track_event
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


def send_smart_nudge(
    settings: Settings,
    db: Session,
    user_id: int,
    request: SmartNudgeBody,
) -> PushBulkResultPublic:
    title, body = _nudge_content(request)
    attempted, delivered, message = send_ping(
        settings,
        db,
        user_id,
        title,
        body,
        data=push_data_dashboard(),
    )
    track_event(
        db,
        "smart_notification_sent",
        user_id,
        {"kind": request.kind, "attempted": attempted, "delivered": delivered},
    )
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


def _nudge_content(request: SmartNudgeBody) -> tuple[str, str]:
    if request.kind == "best_time":
        return push_templates.best_time_nudge(request.hour if request.hour is not None else 20)
    if request.kind == "forecast_risk":
        remaining = request.remaining_sessions if request.remaining_sessions is not None else 2
        days_left = request.days_left if request.days_left is not None else 2
        return push_templates.forecast_risk_nudge(remaining, days_left)
    return push_templates.inactivity_nudge(
        request.days_inactive if request.days_inactive is not None else 3
    )
