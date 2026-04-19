"""Localized push copy (server-side templates)."""

from __future__ import annotations


def format_duration_de(seconds: int) -> str:
    seconds = max(0, seconds)
    m = seconds // 60
    if m < 60:
        return f"{m} Min."
    h, rest = m // 60, m % 60
    return f"{h} Std. {rest} Min." if rest else f"{h} Std."


def session_complete(session_type: str, duration_seconds: int) -> tuple[str, str]:
    title = "Session gespeichert"
    body = f"{session_type} · {format_duration_de(duration_seconds)} — weiter so!"
    return title, body


def streak_reminder(streak_days: int, hours_left: int | None = None) -> tuple[str, str]:
    title = "Streak in Gefahr"
    if hours_left is not None and hours_left > 0:
        body = f"Noch ca. {hours_left} Std. Zeit für deine {streak_days}-Tage-Serie."
    else:
        body = f"Heute noch eine Session — sonst bricht deine {streak_days}-Tage-Serie."
    return title, body


def admin_ping_default() -> tuple[str, str]:
    return "Prodify", "Test-Push vom Server"


def session_demo() -> tuple[str, str]:
    """Sample for QA / profile button."""
    return session_complete("Beat Making", 42 * 60)


def streak_reminder_slot(slot_kind: str, streak_days: int) -> tuple[str, str]:
    """
    slot_kind: streak_utc_22 | streak_utc_23 | streak_utc_2330 (UTC windows).
    """
    title = "Streak in Gefahr"
    if slot_kind == "streak_utc_22":
        body = f"⚠️ Deine {streak_days}-Tage-Serie: noch etwa 2 Stunden im UTC-Tag. Jetzt Session starten!"
    elif slot_kind == "streak_utc_23":
        body = f"🔥 Letzte Chance heute (UTC) — deine {streak_days}-Tage-Serie braucht eine Session."
    elif slot_kind == "streak_utc_2330":
        body = f"⏰ Nur noch ~30 Min. (UTC) für deine {streak_days}-Tage-Serie. Öffne Prodify!"
    else:
        body = streak_reminder(streak_days, hours_left=1)[1]
    return title, body
