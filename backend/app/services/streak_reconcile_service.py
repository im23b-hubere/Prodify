"""Streak state in two flavours: a read-only snapshot for queries, and a row update for writes.

Reads must never persist. Only explicit write paths — completing a session, using a freeze,
`POST /streak/reconcile` — are allowed to touch the `streaks` row.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ProductionSession, Streak, User
from app.services.entitlements import EntitlementService
from app.services.streak_calendar import StreakCalendar, calendar_for, session_day_keys
from app.streakutil import best_streak_run, compute_current_streak, parse_frozen_json


@dataclass(frozen=True)
class StreakSnapshot:
    """Everything the streak endpoints render, derived from sessions and freezes without writing."""

    calendar: StreakCalendar
    current_streak: int
    longest_streak: int
    freezes_remaining: int
    session_days: list[str]
    frozen_days: list[str]
    merged_days: list[str]


def _freeze_limit(user: User | None) -> int:
    return EntitlementService.get_streak_freeze_limit(user) if user else 1


def effective_freezes_remaining(streak: Streak | None, user: User, calendar: StreakCalendar) -> int:
    """What the counter reads right now, including a month rollover that is not persisted yet."""
    if streak is None or streak.billing_month != calendar.month_key:
        return _freeze_limit(user)
    return int(streak.freezes_remaining or 0)


def ensure_monthly_freeze_allowance(streak: Streak, user: User, calendar: StreakCalendar) -> None:
    """Roll the monthly freeze counter over in the user's own timezone."""
    month = calendar.month_key
    if streak.billing_month == month:
        return
    streak.billing_month = month
    streak.freezes_remaining = _freeze_limit(user)


def get_or_create_streak(db: Session, user_id: int) -> Streak:
    row = db.scalar(select(Streak).where(Streak.user_id == user_id))
    if row is not None:
        return row
    row = Streak(
        user_id=user_id,
        current_streak=0,
        longest_streak=0,
        frozen_day_keys="[]",
        freezes_remaining=_freeze_limit(db.get(User, user_id)),
        billing_month="",
    )
    db.add(row)
    db.flush()
    return row


def _snapshot(db: Session, user: User, streak: Streak | None, calendar: StreakCalendar) -> StreakSnapshot:
    session_days = session_day_keys(db, user.id, calendar)
    frozen_days = parse_frozen_json(streak.frozen_day_keys) if streak else []
    merged_days = sorted(set(session_days) | set(frozen_days))
    current = compute_current_streak(merged_days, calendar.today)
    stored_longest = int(streak.longest_streak or 0) if streak else 0
    return StreakSnapshot(
        calendar=calendar,
        current_streak=current,
        longest_streak=max(stored_longest, best_streak_run(merged_days), current),
        freezes_remaining=effective_freezes_remaining(streak, user, calendar),
        session_days=session_days,
        frozen_days=frozen_days,
        merged_days=merged_days,
    )


def load_streak_snapshot(db: Session, user_id: int) -> StreakSnapshot:
    """Read-only streak state for GET endpoints. Raises if the user does not exist."""
    user = db.get(User, user_id)
    if user is None:
        raise ValueError("user not found")
    streak = db.scalar(select(Streak).where(Streak.user_id == user_id))
    return _snapshot(db, user, streak, calendar_for(user))


def reconcile_streak_row_for_user(db: Session, user_id: int) -> tuple[Streak, int, StreakSnapshot]:
    """
    Recompute streak counters from sessions and freezes and persist them.

    Returns the row, the previously stored current streak (so callers can detect a break),
    and the freshly computed snapshot. Does not commit — the caller owns the transaction.
    """
    user = db.get(User, user_id)
    if user is None:
        raise ValueError("user not found")

    calendar = calendar_for(user)
    streak = get_or_create_streak(db, user_id)
    ensure_monthly_freeze_allowance(streak, user, calendar)

    previous_current_streak = int(streak.current_streak or 0)
    snapshot = _snapshot(db, user, streak, calendar)
    streak.current_streak = snapshot.current_streak
    streak.longest_streak = snapshot.longest_streak
    _refresh_last_session_date(db, user_id, streak)
    return streak, previous_current_streak, snapshot


def compute_streak_counts_for_display(db: Session, user_id: int) -> tuple[int, int]:
    """Streak numbers for friend and leaderboard views, without writing on every read."""
    user = db.get(User, user_id)
    if user is None:
        return 0, 0
    streak = db.scalar(select(Streak).where(Streak.user_id == user_id))
    snapshot = _snapshot(db, user, streak, calendar_for(user))
    return snapshot.current_streak, snapshot.longest_streak


def _refresh_last_session_date(db: Session, user_id: int, streak: Streak) -> None:
    streak.last_session_date = db.scalar(
        select(func.max(ProductionSession.stopped_at)).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    )
