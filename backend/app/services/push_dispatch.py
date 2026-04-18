"""Route push notifications to Expo vs FCM channels."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.config import Settings
from app.models import PushToken
from app.services import expo_client, fcm_client
from app.services import push_templates
from app.services.push_links import push_data_dashboard

logger = logging.getLogger(__name__)


def dispatch_to_user(
    settings: Settings,
    db: DBSession,
    user_id: int,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> tuple[int, int, str | None]:
    """
    Send title/body to all push_tokens for user.
    Returns (total_attempted, total_ok, combined_message).
    """
    rows = db.scalars(select(PushToken).where(PushToken.user_id == user_id)).all()
    expo_tokens: list[str] = []
    fcm_tokens: list[str] = []
    seen: set[tuple[str, str]] = set()
    for r in rows:
        key = (r.token, r.channel or "expo")
        if key in seen:
            continue
        seen.add(key)
        ch = (r.channel or "expo").lower()
        if ch == "fcm":
            fcm_tokens.append(r.token)
        else:
            expo_tokens.append(r.token)

    expo_tokens = expo_tokens[:100]
    fcm_tokens = fcm_tokens[:100]

    if not expo_tokens and not fcm_tokens:
        return 0, 0, "no push tokens registered"

    total_attempted = len(expo_tokens) + len(fcm_tokens)
    total_ok = 0
    parts: list[str] = []

    expo_key = (settings.expo_access_token or "").strip()
    if expo_tokens:
        if expo_key:
            def _expo_msg(token: str) -> dict:
                m: dict = {
                    "to": token,
                    "title": title[:64],
                    "body": body[:200],
                    "sound": "default",
                    "priority": "high",
                }
                if data:
                    m["data"] = {str(k): str(v) for k, v in data.items()}
                return m

            messages = [_expo_msg(t) for t in expo_tokens]
            a, o, err = expo_client.send_expo_batch(expo_key, messages)
            total_ok += o
            parts.append(f"Expo {o}/{a}")
            if err:
                parts.append(err)
        else:
            parts.append(f"Expo 0/{len(expo_tokens)} (no EXPO_ACCESS_TOKEN)")

    if fcm_tokens:
        a, o, err = fcm_client.send_fcm_data_messages(settings, fcm_tokens, title, body, data=data)
        total_ok += o
        parts.append(f"FCM {o}/{a}")
        if err:
            parts.append(err)

    summary = " · ".join(parts) if parts else None
    return total_attempted, total_ok, summary


def notify_session_complete(settings: Settings, db: DBSession, user_id: int, session_type: str, duration_seconds: int) -> None:
    title, body = push_templates.session_complete(session_type, duration_seconds)
    payload = {**push_data_dashboard(), "kind": "session_complete"}
    try:
        attempted, ok, msg = dispatch_to_user(settings, db, user_id, title, body, data=payload)
        if msg and ok < attempted:
            logger.info("push session-complete: ok=%s/%s %s", ok, attempted, msg)
    except Exception:
        logger.exception("push session-complete failed")


def send_ping(
    settings: Settings,
    db: DBSession,
    user_id: int,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> tuple[int, int, str | None]:
    return dispatch_to_user(settings, db, user_id, title, body, data=data)
