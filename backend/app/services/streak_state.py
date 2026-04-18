"""Read-only streak snapshot for background jobs (no DB writes)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ProductionSession, Streak, utcnow
from app.streakutil import compute_current_streak, parse_frozen_json
from app.timeutil import as_utc_aware


def session_day_keys(db: Session, user_id: int) -> list[str]:
    rows = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()
    return [as_utc_aware(r.started_at).date().isoformat() for r in rows]


def streak_snapshot(db: Session, user_id: int) -> tuple[int, bool]:
    """Returns (current_streak_days, streak_at_risk)."""
    streak = db.scalar(select(Streak).where(Streak.user_id == user_id))
    frozen = parse_frozen_json(streak.frozen_day_keys) if streak else []
    session_days = session_day_keys(db, user_id)
    merged = list(set(session_days) | set(frozen))
    cur = compute_current_streak(merged)
    today = utcnow().date().isoformat()
    has_session_today = today in set(session_days)
    frozen_today = today in set(frozen)
    at_risk = cur > 0 and not has_session_today and not frozen_today
    return cur, at_risk
