"""English push notification copy (server-side templates)."""

from __future__ import annotations

_SESSION_TYPE_LABELS: dict[str, str] = {
    "beat_making": "Beat Making",
    "mixing": "Mixing",
    "mastering": "Mastering",
    "mix_and_master": "Mix & Master",
    "sound_design": "Sound Design",
    "recording": "Recording",
    "songwriting": "Songwriting",
    "arrangement": "Arrangement",
    "vocal_production": "Vocal Production",
    "learning": "Learning / Practice",
}


def _session_label(session_type: str) -> str:
    return _SESSION_TYPE_LABELS.get(session_type, session_type.replace("_", " ").title())


def format_duration_en(seconds: int) -> str:
    seconds = max(0, seconds)
    m = seconds // 60
    if m < 60:
        return f"{m} min"
    h, rest = m // 60, m % 60
    return f"{h}h {rest}m" if rest else f"{h}h"


def session_complete(session_type: str, duration_seconds: int) -> tuple[str, str]:
    title = "Session saved"
    label = _session_label(session_type)
    body = f"{label} · {format_duration_en(duration_seconds)} — nice work!"
    return title, body


def streak_reminder(streak_days: int, hours_left: int | None = None) -> tuple[str, str]:
    title = "Streak at risk"
    if hours_left is not None and hours_left > 0:
        body = f"About {hours_left}h left to protect your {streak_days}-day streak."
    else:
        body = f"Log a session today — your {streak_days}-day streak needs you."
    return title, body


def admin_ping_default() -> tuple[str, str]:
    return "Prodify", "Test push from server"


def session_demo() -> tuple[str, str]:
    """Sample for QA / profile button."""
    return session_complete("beat_making", 42 * 60)


def streak_reminder_slot(slot_kind: str, streak_days: int) -> tuple[str, str]:
    """
    slot_kind: streak_utc_22 | streak_utc_23 | streak_utc_2330 (UTC windows).
    """
    title = "Streak at risk"
    if slot_kind == "streak_utc_22":
        body = f"⚠️ Your {streak_days}-day streak: ~2 hours left in the UTC day. Start a session!"
    elif slot_kind == "streak_utc_23":
        body = f"🔥 Last chance today (UTC) — your {streak_days}-day streak needs a session."
    elif slot_kind == "streak_utc_2330":
        body = f"⏰ ~30 min left (UTC) for your {streak_days}-day streak. Open Prodify!"
    else:
        body = streak_reminder(streak_days, hours_left=1)[1]
    return title, body
