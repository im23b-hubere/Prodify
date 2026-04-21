"""Central streak row updates (current/longest/last_session_date) used by API reads and session writes."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ProductionSession, Streak, User, utcnow
from app.services.entitlements import EntitlementService
from app.streakutil import best_streak_run, compute_current_streak, parse_frozen_json
from app.timeutil import as_utc_aware


def list_session_day_keys(db: Session, user_id: int) -> list[str]:
    rows = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()
    return [as_utc_aware(r.started_at).date().isoformat() for r in rows]


def _refresh_last_session_date(db: Session, user_id: int, streak: Streak) -> None:
    last_at = db.scalar(
        select(func.max(ProductionSession.stopped_at)).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    )
    streak.last_session_date = last_at


def ensure_monthly_freeze_allowance(streak: Streak, user: User) -> None:
    """Reset monthly freeze counter; premium users receive a higher cap from entitlements."""
    m = utcnow().strftime("%Y-%m")
    limit = EntitlementService.get_streak_freeze_limit(user)
    if not streak.billing_month:
        streak.billing_month = m
        streak.freezes_remaining = limit
        return
    if streak.billing_month != m:
        streak.billing_month = m
        streak.freezes_remaining = limit


def get_or_create_streak(db: Session, user_id: int) -> Streak:
    row = db.scalar(select(Streak).where(Streak.user_id == user_id))
    if row is None:
        user = db.get(User, user_id)
        limit = EntitlementService.get_streak_freeze_limit(user) if user else 1
        row = Streak(
            user_id=user_id,
            current_streak=0,
            longest_streak=0,
            frozen_day_keys="[]",
            freezes_remaining=limit,
            billing_month="",
        )
        db.add(row)
        db.flush()
    return row


def reconcile_streak_row_for_user(db: Session, user_id: int) -> tuple[Streak, int, int, list[str], list[str]]:
    """
    Recompute streak counters from sessions + freezes, persist, refresh last_session_date.

    Returns (streak_row, previous_stored_current_streak, new_computed_current_streak,
            merged_day_keys, session_only_day_keys).
    """
    user = db.get(User, user_id)
    if user is None:
        raise ValueError("user not found")

    streak = get_or_create_streak(db, user_id)
    ensure_monthly_freeze_allowance(streak, user)

    prev = int(streak.current_streak or 0)
    session_days = list_session_day_keys(db, user_id)
    frozen = parse_frozen_json(streak.frozen_day_keys)
    merged = list(set(session_days) | set(frozen))
    cur = compute_current_streak(merged)
    best = best_streak_run(merged)
    streak.current_streak = cur
    streak.longest_streak = max(int(streak.longest_streak or 0), best, cur)
    _refresh_last_session_date(db, user_id, streak)
    return streak, prev, cur, merged, session_days


def compute_streak_counts_for_display(db: Session, user_id: int) -> tuple[int, int]:
    """
    Read-only streak numbers for friend/leaderboard views (avoids stale persisted `current_streak`
    without writing on every read).
    """
    streak = db.scalar(select(Streak).where(Streak.user_id == user_id))
    session_days = list_session_day_keys(db, user_id)
    frozen = parse_frozen_json(streak.frozen_day_keys) if streak else []
    merged = list(set(session_days) | set(frozen))
    cur = compute_current_streak(merged)
    best = best_streak_run(merged)
    stored_longest = int(streak.longest_streak or 0) if streak else 0
    longest = max(stored_longest, best, cur)
    return cur, longest
