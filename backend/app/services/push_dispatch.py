"""Route push notifications to Expo and FCM channels."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
import logging
import threading

from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.config import Settings
from app.models import PushToken, utcnow
from app.services import expo_client, fcm_client, push_templates
from app.services.push_links import push_data_dashboard

logger = logging.getLogger(__name__)
_push_executor: ThreadPoolExecutor | None = None
_push_executor_size: int | None = None
_push_executor_lock = threading.Lock()


@dataclass(frozen=True)
class PushChannels:
    expo: list[str]
    fcm: list[str]

    @property
    def attempted(self) -> int:
        return len(self.expo) + len(self.fcm)

    @property
    def all_tokens(self) -> list[str]:
        return [*self.expo, *self.fcm]


@dataclass(frozen=True)
class ChannelDelivery:
    delivered: int
    summary_parts: list[str]


def _get_push_executor(settings: Settings) -> ThreadPoolExecutor:
    global _push_executor, _push_executor_size
    max_workers = max(1, int(settings.push_async_max_workers or 1))
    if _push_executor is not None and _push_executor_size == max_workers:
        return _push_executor
    with _push_executor_lock:
        if _push_executor is not None and _push_executor_size == max_workers:
            return _push_executor
        _push_executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="push-dispatch")
        _push_executor_size = max_workers
        return _push_executor


def dispatch_to_user(
    settings: Settings,
    db: DBSession,
    user_id: int,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> tuple[int, int, str | None]:
    """Send a notification to every unique active token for a user."""
    channels = _load_push_channels(db, user_id)
    if channels.attempted == 0:
        return 0, 0, "no push tokens registered"

    deliveries = [
        _deliver_expo(settings, db, channels.expo, title, body, data),
        _deliver_fcm(settings, db, channels.fcm, title, body, data),
    ]
    _touch_attempted_tokens(db, user_id, channels.all_tokens)
    delivered = sum(result.delivered for result in deliveries)
    summary_parts = [part for result in deliveries for part in result.summary_parts]
    return channels.attempted, delivered, " · ".join(summary_parts) if summary_parts else None


def _load_push_channels(db: DBSession, user_id: int) -> PushChannels:
    rows = db.execute(
        select(PushToken.token, PushToken.channel).where(
            PushToken.user_id == user_id,
            PushToken.is_active == 1,
        )
    ).all()
    expo: list[str] = []
    fcm: list[str] = []
    seen: set[tuple[str, str]] = set()
    for token, raw_channel in rows:
        channel = (raw_channel or "expo").lower()
        key = token, channel
        if key in seen:
            continue
        seen.add(key)
        (fcm if channel == "fcm" else expo).append(token)
    return PushChannels(expo=expo[:100], fcm=fcm[:100])


def _deliver_expo(
    settings: Settings,
    db: DBSession,
    tokens: list[str],
    title: str,
    body: str,
    data: dict[str, str] | None,
) -> ChannelDelivery:
    if not tokens:
        return ChannelDelivery(0, [])
    access_token = (settings.expo_access_token or "").strip()
    if not access_token:
        return ChannelDelivery(0, [f"Expo 0/{len(tokens)} (no EXPO_ACCESS_TOKEN)"])
    messages = [_expo_message(token, title, body, data) for token in tokens]
    attempted, delivered, error, invalid_tokens = expo_client.send_expo_batch(access_token, messages)
    parts = [f"Expo {delivered}/{attempted}"]
    if error:
        parts.append(error)
    deactivated = _deactivate_invalid_tokens(db, "expo", invalid_tokens)
    if deactivated:
        parts.append(f"Expo deactivated={deactivated}")
    return ChannelDelivery(delivered, parts)


def _expo_message(
    token: str,
    title: str,
    body: str,
    data: dict[str, str] | None,
) -> dict:
    message: dict = {
        "to": token,
        "title": title[:64],
        "body": body[:200],
        "sound": "default",
        "priority": "high",
    }
    if data:
        message["data"] = {str(key): str(value) for key, value in data.items()}
    return message


def _deliver_fcm(
    settings: Settings,
    db: DBSession,
    tokens: list[str],
    title: str,
    body: str,
    data: dict[str, str] | None,
) -> ChannelDelivery:
    if not tokens:
        return ChannelDelivery(0, [])
    attempted, delivered, error, invalid_tokens = fcm_client.send_fcm_data_messages(
        settings,
        tokens,
        title,
        body,
        data=data,
    )
    parts = [f"FCM {delivered}/{attempted}"]
    if error:
        parts.append(error)
    deactivated = _deactivate_invalid_tokens(db, "fcm", invalid_tokens)
    if deactivated:
        parts.append(f"FCM deactivated={deactivated}")
    return ChannelDelivery(delivered, parts)


def _deactivate_invalid_tokens(db: DBSession, channel: str, tokens: list[str]) -> int:
    normalized = [token.strip() for token in tokens if token and token.strip()]
    if not normalized:
        return 0
    rows = db.scalars(
        select(PushToken).where(PushToken.channel == channel, PushToken.token.in_(normalized))
    ).all()
    deactivated = 0
    for row in rows:
        if row.is_active == 1:
            row.is_active = 0
            deactivated += 1
    return deactivated


def _touch_attempted_tokens(db: DBSession, user_id: int, tokens: list[str]) -> None:
    rows = db.scalars(
        select(PushToken).where(
            PushToken.user_id == user_id,
            PushToken.is_active == 1,
            PushToken.token.in_(tokens),
        )
    ).all()
    now = utcnow()
    for row in rows:
        row.last_used_at = now


def notify_session_complete(
    settings: Settings,
    db: DBSession,
    user_id: int,
    session_type: str,
    duration_seconds: int,
) -> None:
    title, body = push_templates.session_complete(session_type, duration_seconds)
    payload = {**push_data_dashboard(), "kind": "session_complete"}
    try:
        attempted, delivered, summary = dispatch_to_user(
            settings,
            db,
            user_id,
            title,
            body,
            data=payload,
        )
        db.commit()
        if summary and delivered < attempted:
            logger.info("push session-complete: ok=%s/%s %s", delivered, attempted, summary)
    except Exception:
        db.rollback()
        logger.exception("push session-complete failed")


def schedule_notify_session_complete(
    settings: Settings,
    user_id: int,
    session_type: str,
    duration_seconds: int,
) -> None:
    """Fire-and-forget push so HTTP workers are not blocked on upstream latency."""

    def run_notification() -> None:
        from app.database import SessionLocal

        try:
            with SessionLocal() as background_db:
                notify_session_complete(
                    settings,
                    background_db,
                    user_id,
                    session_type,
                    duration_seconds,
                )
        except Exception:
            logger.exception("deferred push session-complete failed")

    backend = (settings.push_async_backend or "threadpool").strip().lower()
    if backend == "inline":
        run_notification()
        return
    if backend == "arq":
        logger.warning("push_async_backend=arq is not wired yet; falling back to threadpool")
    try:
        _get_push_executor(settings).submit(run_notification)
    except RuntimeError:
        logger.warning("push dispatch executor unavailable; dropping deferred session-complete push")


def send_ping(
    settings: Settings,
    db: DBSession,
    user_id: int,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> tuple[int, int, str | None]:
    return dispatch_to_user(settings, db, user_id, title, body, data=data)
