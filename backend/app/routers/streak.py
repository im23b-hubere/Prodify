import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ProductionSession, Streak, User, utcnow
from app.schemas import (
    StreakFreezeResult,
    StreakMilestoneItem,
    StreakMilestonesPublic,
    StreakOverviewPublic,
    StreakRunPublic,
)
from app.streakutil import (
    best_streak_run,
    compute_current_streak,
    compute_streak_runs,
    dump_frozen_json,
    last_7_day_states,
    parse_frozen_json,
)
from app.timeutil import as_utc_aware

router = APIRouter(prefix="/streak", tags=["streak"])

MILESTONES: list[tuple[int, str]] = [
    (3, "Getting started"),
    (7, "One week warrior"),
    (14, "Two weeks strong"),
    (30, "Producer Legend"),
    (60, "Unstoppable"),
    (100, "Producer God"),
]


def _get_or_create_streak(db: Session, user_id: int) -> Streak:
    row = db.scalar(select(Streak).where(Streak.user_id == user_id))
    if row is None:
        row = Streak(
            user_id=user_id,
            current_streak=0,
            longest_streak=0,
            frozen_day_keys="[]",
            freezes_remaining=1,
            billing_month="",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _ensure_monthly_freeze(streak: Streak) -> None:
    m = utcnow().strftime("%Y-%m")
    if not streak.billing_month:
        streak.billing_month = m
        return
    if streak.billing_month != m:
        streak.freezes_remaining = 1
        streak.billing_month = m


def _session_day_keys(db: Session, user_id: int) -> list[str]:
    rows = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()
    return [as_utc_aware(r.started_at).date().isoformat() for r in rows]


def _next_milestone(current: int) -> tuple[int | None, str | None, int | None]:
    for days, title in MILESTONES:
        if current < days:
            return days, title, days - current
    return None, None, None


@router.get("/overview", response_model=StreakOverviewPublic)
def streak_overview(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    streak = _get_or_create_streak(db, current.id)
    _ensure_monthly_freeze(streak)

    session_days = _session_day_keys(db, current.id)
    frozen = parse_frozen_json(streak.frozen_day_keys)
    merged = list(set(session_days) | set(frozen))

    cur = compute_current_streak(merged)
    best = best_streak_run(merged)
    streak.current_streak = cur
    streak.longest_streak = max(streak.longest_streak, best, cur)
    db.commit()
    db.refresh(streak)

    today = utcnow().date().isoformat()
    has_session_today = today in set(session_days)
    frozen_today = today in set(frozen)
    streak_at_risk = cur > 0 and not has_session_today and not frozen_today

    can_use = (
        streak_at_risk
        and streak.freezes_remaining > 0
        and not frozen_today
        and not has_session_today
    )

    states, labels = last_7_day_states(session_days, frozen)
    nm_at, nm_title, nm_left = _next_milestone(cur)

    return StreakOverviewPublic(
        current_streak=cur,
        longest_streak=streak.longest_streak,
        last_7_day_states=states,
        last_7_day_labels=labels,
        next_milestone_at=nm_at,
        next_milestone_title=nm_title,
        days_to_next_milestone=nm_left,
        freezes_remaining=streak.freezes_remaining,
        can_use_freeze=can_use,
        streak_at_risk=streak_at_risk,
        tagline="Don't break the chain!",
    )


@router.get("/history", response_model=list[StreakRunPublic])
def streak_history(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 40,
):
    streak = _get_or_create_streak(db, current.id)
    _ensure_monthly_freeze(streak)
    session_days = _session_day_keys(db, current.id)
    frozen = parse_frozen_json(streak.frozen_day_keys)
    merged = list(set(session_days) | set(frozen))
    runs = compute_streak_runs(merged)
    if limit < 1:
        limit = 1
    if limit > 120:
        limit = 120
    out: list[StreakRunPublic] = []
    for start, end, length in runs[:limit]:
        out.append(StreakRunPublic(start_date=start, end_date=end, length_days=length))
    return out


@router.get("/milestones", response_model=StreakMilestonesPublic)
def streak_milestones(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    streak = _get_or_create_streak(db, current.id)
    _ensure_monthly_freeze(streak)
    session_days = _session_day_keys(db, current.id)
    frozen = parse_frozen_json(streak.frozen_day_keys)
    merged = list(set(session_days) | set(frozen))
    cur = compute_current_streak(merged)
    best = best_streak_run(merged)
    streak.current_streak = cur
    streak.longest_streak = max(streak.longest_streak, best, cur)
    db.commit()
    db.refresh(streak)
    longest = streak.longest_streak
    items = [
        StreakMilestoneItem(days=days, title=title, unlocked=longest >= days)
        for days, title in MILESTONES
    ]
    return StreakMilestonesPublic(milestones=items, longest_streak_days=longest)


@router.post("/freeze", response_model=StreakFreezeResult)
def use_streak_freeze(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    streak = _get_or_create_streak(db, current.id)
    _ensure_monthly_freeze(streak)

    session_days = _session_day_keys(db, current.id)
    frozen = parse_frozen_json(streak.frozen_day_keys)
    merged = list(set(session_days) | set(frozen))
    cur = compute_current_streak(merged)

    today = utcnow().date().isoformat()
    has_session_today = today in set(session_days)

    if has_session_today:
        raise HTTPException(status_code=400, detail="You already completed a session today.")
    if today in frozen:
        raise HTTPException(status_code=400, detail="Streak freeze already used for today.")
    if streak.freezes_remaining < 1:
        raise HTTPException(status_code=400, detail="No streak freezes left this month.")
    if cur < 1:
        raise HTTPException(status_code=400, detail="Start a streak before using a freeze.")

    frozen.append(today)
    streak.frozen_day_keys = dump_frozen_json(frozen)
    streak.freezes_remaining -= 1
    db.commit()
    db.refresh(streak)

    merged2 = list(set(session_days) | set(frozen))
    new_cur = compute_current_streak(merged2)
    streak.current_streak = new_cur
    streak.longest_streak = max(streak.longest_streak, best_streak_run(merged2), new_cur)
    db.commit()

    return StreakFreezeResult(
        success=True,
        message="Streak Freeze activated! You're safe for today.",
        current_streak=new_cur,
        freezes_remaining=streak.freezes_remaining,
    )
