from __future__ import annotations


def streak_status_for_days(current_streak: int, inactive_days: int = 0) -> tuple[str, str, str]:
    """
    Public streak status visible to friends.
    Returns: (status_key, label, emoji)
    """
    if inactive_days >= 2:
        return ("broken", "BROKEN", "💔")
    if inactive_days == 1 and current_streak <= 0:
        return ("at_risk", "AT RISK", "⚠️")
    if current_streak >= 30:
        return ("on_fire", "ON FIRE", "🔥")
    if current_streak >= 14:
        return ("consistent", "CONSISTENT", "⚡")
    if current_streak >= 7:
        return ("building", "BUILDING", "💪")
    if current_streak >= 3:
        return ("starting", "STARTING", "🌱")
    return ("starting", "STARTING", "🌱")
