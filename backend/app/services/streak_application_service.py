from sqlalchemy.orm import Session

from app.contracts.insights import (
    StreakFreezeResult,
    StreakMilestoneItem,
    StreakMilestonesPublic,
    StreakOverviewPublic,
    StreakRunPublic,
)
from app.models import User, utcnow
from app.services.social_consequence import maybe_notify_streak_break_on_transition
from app.services.streak_reconcile_service import (
    ensure_monthly_freeze_allowance,
    get_or_create_streak,
    list_session_day_keys,
    reconcile_streak_row_for_user,
)
from app.streakutil import (
    best_streak_run,
    build_calendar_weeks,
    compute_current_streak,
    compute_streak_runs,
    dump_frozen_json,
    last_7_day_states,
    parse_frozen_json,
)

MILESTONES: list[tuple[int, str]] = [
    (3, "Getting started"),
    (7, "One week warrior"),
    (14, "Two weeks strong"),
    (30, "Producer Legend"),
    (60, "Unstoppable"),
    (100, "Producer God"),
]


class StreakFreezeError(ValueError):
    pass


class SessionAlreadyCompletedError(StreakFreezeError):
    pass


class FreezeAlreadyUsedError(StreakFreezeError):
    pass


class NoFreezesRemainingError(StreakFreezeError):
    pass


class StreakNotStartedError(StreakFreezeError):
    pass


def reconcile_streak(db: Session, user_id: int) -> None:
    streak, previous, current, _, _ = reconcile_streak_row_for_user(db, user_id)
    db.commit()
    db.refresh(streak)
    maybe_notify_streak_break_on_transition(previous, current, user_id)


def build_streak_overview(db: Session, user_id: int) -> StreakOverviewPublic:
    streak, _, current, _, session_days = reconcile_streak_row_for_user(db, user_id)
    db.commit()
    db.refresh(streak)
    today = utcnow().date().isoformat()
    frozen_days = parse_frozen_json(streak.frozen_day_keys)
    has_session_today = today in set(session_days)
    frozen_today = today in set(frozen_days)
    streak_at_risk = current > 0 and not has_session_today and not frozen_today
    can_use_freeze = (
        streak_at_risk
        and streak.freezes_remaining > 0
        and not frozen_today
        and not has_session_today
    )
    states, labels = last_7_day_states(session_days, frozen_days)
    calendar_weeks = build_calendar_weeks(session_days, frozen_days)
    milestone_at, milestone_title, days_left = _next_milestone(current)
    return StreakOverviewPublic(
        current_streak=current,
        longest_streak=streak.longest_streak,
        last_7_day_states=states,
        last_7_day_labels=labels,
        calendar_weeks=calendar_weeks,
        next_milestone_at=milestone_at,
        next_milestone_title=milestone_title,
        days_to_next_milestone=days_left,
        freezes_remaining=streak.freezes_remaining,
        can_use_freeze=can_use_freeze,
        streak_at_risk=streak_at_risk,
        tagline="Don't break the chain!",
    )


def build_streak_history(db: Session, user_id: int, limit: int) -> list[StreakRunPublic]:
    _, _, _, merged_days, _ = reconcile_streak_row_for_user(db, user_id)
    db.commit()
    bounded_limit = max(1, min(limit, 120))
    return [
        StreakRunPublic(start_date=start, end_date=end, length_days=length)
        for start, end, length in compute_streak_runs(merged_days)[:bounded_limit]
    ]


def build_streak_milestones(db: Session, user_id: int) -> StreakMilestonesPublic:
    streak, _, _, _, _ = reconcile_streak_row_for_user(db, user_id)
    db.commit()
    db.refresh(streak)
    return StreakMilestonesPublic(
        milestones=[
            StreakMilestoneItem(
                days=days,
                title=title,
                unlocked=streak.longest_streak >= days,
            )
            for days, title in MILESTONES
        ],
        longest_streak_days=streak.longest_streak,
    )


def use_streak_freeze(db: Session, user: User) -> StreakFreezeResult:
    streak = get_or_create_streak(db, user.id)
    ensure_monthly_freeze_allowance(streak, user)
    session_days = list_session_day_keys(db, user.id)
    frozen_days = parse_frozen_json(streak.frozen_day_keys)
    current = compute_current_streak(list(set(session_days) | set(frozen_days)))
    today = utcnow().date().isoformat()
    _validate_freeze(today, session_days, frozen_days, streak.freezes_remaining, current)
    frozen_days.append(today)
    merged_days = list(set(session_days) | set(frozen_days))
    new_current = compute_current_streak(merged_days)
    streak.frozen_day_keys = dump_frozen_json(frozen_days)
    streak.freezes_remaining -= 1
    streak.current_streak = new_current
    streak.longest_streak = max(
        streak.longest_streak,
        best_streak_run(merged_days),
        new_current,
    )
    db.commit()
    db.refresh(streak)
    return StreakFreezeResult(
        success=True,
        message="Streak Freeze activated! You're safe for today.",
        current_streak=new_current,
        freezes_remaining=streak.freezes_remaining,
    )


def _validate_freeze(
    today: str,
    session_days: list[str],
    frozen_days: list[str],
    freezes_remaining: int,
    current_streak: int,
) -> None:
    if today in set(session_days):
        raise SessionAlreadyCompletedError
    if today in set(frozen_days):
        raise FreezeAlreadyUsedError
    if freezes_remaining < 1:
        raise NoFreezesRemainingError
    if current_streak < 1:
        raise StreakNotStartedError


def _next_milestone(current: int) -> tuple[int | None, str | None, int | None]:
    for days, title in MILESTONES:
        if current < days:
            return days, title, days - current
    return None, None, None
