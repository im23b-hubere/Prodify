"""When an open session needs a still-there nudge or an eight-hour safety stop."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal

from app.timeutil import as_utc_aware

SESSION_STILL_THERE_SECONDS = 3 * 3600
SESSION_AUTO_STOP_SECONDS = 8 * 3600

SessionPresenceAction = Literal["none", "nudge", "stop"]


def effective_elapsed_seconds(session: object, now: datetime) -> int:
    """Work time. A pause freezes the clock so the timer does not count the break."""
    started = as_utc_aware(getattr(session, "started_at"))
    paused_completed = int(getattr(session, "paused_duration_seconds", 0) or 0)
    pause_started_at = getattr(session, "pause_started_at", None)
    current = as_utc_aware(pause_started_at) if pause_started_at is not None else as_utc_aware(now)
    return max(0, int((current - started).total_seconds()) - paused_completed)


def open_elapsed_seconds(session: object, now: datetime) -> int:
    """How long the single open slot has been held, including the current pause."""
    started = as_utc_aware(getattr(session, "started_at"))
    paused_completed = int(getattr(session, "paused_duration_seconds", 0) or 0)
    return max(0, int((as_utc_aware(now) - started).total_seconds()) - paused_completed)


def session_presence_action(session: object, now: datetime) -> SessionPresenceAction:
    if getattr(session, "stopped_at", None) is not None or getattr(session, "deleted_at", None) is not None:
        return "none"
    if open_elapsed_seconds(session, now) >= SESSION_AUTO_STOP_SECONDS:
        return "stop"
    return decide_session_presence(
        effective_elapsed_seconds(session, now),
        is_running=getattr(session, "pause_started_at", None) is None,
        already_nudged=getattr(session, "still_there_notified_at", None) is not None,
    )


def decide_session_presence(
    elapsed_seconds: int,
    *,
    is_running: bool,
    already_nudged: bool,
) -> SessionPresenceAction:
    if not is_running:
        return "none"
    if elapsed_seconds >= SESSION_AUTO_STOP_SECONDS:
        return "stop"
    if not already_nudged and elapsed_seconds >= SESSION_STILL_THERE_SECONDS:
        return "nudge"
    return "none"


def stop_deadline(session: object, now: datetime) -> datetime:
    started = as_utc_aware(getattr(session, "started_at"))
    paused = int(getattr(session, "paused_duration_seconds", 0) or 0)
    deadline = started + timedelta(seconds=paused + SESSION_AUTO_STOP_SECONDS)
    current = as_utc_aware(now)
    return min(deadline, current)
