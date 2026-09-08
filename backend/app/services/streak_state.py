"""Read-only streak snapshot for background jobs (no DB writes)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Streak, User
from app.services.streak_calendar import calendar_for, session_day_keys
from app.streakutil import compute_current_streak, parse_frozen_json


def streak_snapshot(db: Session, user_id: int) -> tuple[int, bool]:
    """Returns (current_streak_days, streak_at_risk) using the user's own day boundaries."""
    user = db.get(User, user_id)
    if user is None:
        return 0, False
    calendar = calendar_for(user)
    streak = db.scalar(select(Streak).where(Streak.user_id == user_id))
    frozen = parse_frozen_json(streak.frozen_day_keys) if streak else []
    session_days = session_day_keys(db, user_id, calendar)
    current = compute_current_streak(sorted(set(session_days) | set(frozen)), calendar.today)
    today = calendar.today_key
    at_risk = current > 0 and today not in set(session_days) and today not in set(frozen)
    return current, at_risk
