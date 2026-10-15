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
    "production": "Production",
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
    body = f"{label} · {format_duration_en(duration_seconds)}"
    return title, body


def streak_reminder(streak_days: int, hours_left: int | None = None) -> tuple[str, str]:
    title = "Streak at risk"
    if hours_left is not None and hours_left > 0:
        body = f"About {hours_left}h left to keep your {streak_days}-day streak."
    else:
        body = f"Start a session today to keep your {streak_days}-day streak."
    return title, body


def admin_ping_default() -> tuple[str, str]:
    return "Prodify", "Test push from server"


def session_demo() -> tuple[str, str]:
    """Sample for QA / profile button."""
    return session_complete("beat_making", 42 * 60)


def streak_reminder_slot(slot_kind: str, streak_days: int) -> tuple[str, str]:
    """slot_kind: streak_2h_left | streak_1h_left | streak_30m_left (user's local evening)."""
    title = "Streak at risk"
    if slot_kind == "streak_2h_left":
        body = f"Your {streak_days}-day streak needs a session — about 2 hours left today."
    elif slot_kind == "streak_1h_left":
        body = f"One hour left today to keep your {streak_days}-day streak."
    elif slot_kind == "streak_30m_left":
        body = f"About 30 minutes left to keep your {streak_days}-day streak."
    else:
        body = streak_reminder(streak_days, hours_left=1)[1]
    return title, body


def friend_nudge(sender_username: str) -> tuple[str, str]:
    return f"👊 {sender_username} nudged you", "Studio time? Your crew is waiting on your next session."


def session_still_there() -> tuple[str, str]:
    return (
        "Still there?",
        "Your session is still running. Open Prodify to continue or end it.",
    )


def session_auto_stopped() -> tuple[str, str]:
    return "Session ended", "Your session was stopped after 8 hours."


# Keep in sync with `progression.levelNames` in mobile/locales/en.json.
RANK_NAMES: dict[int, str] = {
    1: "Bedroom Producer",
    2: "Loop Sketcher",
    3: "Beat Builder",
    4: "Crate Digger",
    5: "Hook Writer",
    6: "Arrangement Brain",
    7: "Synth Tweaker",
    8: "DAW Demon",
    9: "Drum Pocket",
    10: "Sub Sculptor",
    11: "Mix Engineer",
    12: "Sidechain Surgeon",
    13: "Stereo Architect",
    14: "Bus Compressor",
    15: "Pre-Master",
    16: "Final Bounce",
    17: "Release Ready",
    18: "Platinum Ears",
    19: "Studio Legend",
    20: "Hall of Sound",
}


def _minutes_phrase(minutes: int) -> str:
    if minutes < 60:
        return f"{minutes} minutes"
    hours = round(minutes / 60)
    return "about 1 hour" if hours == 1 else f"about {hours} hours"


def streak_at_risk(streak_days: int, minutes_to_goal: int) -> tuple[str, str]:
    return (
        "Keep the streak alive",
        f"Your {streak_days}-day streak needs one session — {_minutes_phrase(minutes_to_goal)} left today.",
    )


def reengagement(days_inactive: int) -> tuple[str, str]:
    return (
        "Your studio misses you",
        f"It's been {days_inactive} days. Even a short session gets the ideas moving again.",
    )


def rank_close(xp_remaining: int, rank_name: str) -> tuple[str, str]:
    return (
        f"{rank_name} is within reach",
        f"Only {xp_remaining} XP to go — one solid session could get you there.",
    )


def challenge_close(challenge_name: str, sessions_remaining: int) -> tuple[str, str]:
    sessions = "1 more session" if sessions_remaining == 1 else f"{sessions_remaining} more sessions"
    return "Almost there", f"{sessions} and you finish “{challenge_name}”."


def challenge_deadline(challenge_name: str, sessions_remaining: int) -> tuple[str, str]:
    sessions = "1 session" if sessions_remaining == 1 else f"{sessions_remaining} sessions"
    return "Challenge ends soon", f"“{challenge_name}” wraps up soon — {sessions} still to go."


def challenge_stalled(challenge_name: str) -> tuple[str, str]:
    return "Back to the challenge?", f"“{challenge_name}” is waiting on your next session."


def friend_finished_session(friend_name: str, duration_minutes: int) -> tuple[str, str]:
    return (
        f"{friend_name} just finished a session",
        f"{duration_minutes} minutes in the studio. Your turn?",
    )


def friend_overtook(friend_name: str) -> tuple[str, str]:
    return f"{friend_name} passed you", "They just moved ahead of you this week. One session to win it back."
