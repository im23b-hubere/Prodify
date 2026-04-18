from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ProductionSession, Streak, User, UserGoal, utcnow
from app.schemas import (
    HeatmapDayPublic,
    HeatmapPublic,
    PersonalRecordItem,
    PersonalRecordsPublic,
    ProductivityInsightsPublic,
    StatsInsightsPublic,
)
from app.streakutil import best_streak_run, compute_current_streak, parse_frozen_json
from app.timeutil import as_utc_aware

router = APIRouter(prefix="/stats", tags=["stats"])


def _monday(d: date) -> str:
    return (d - timedelta(days=d.weekday())).isoformat()


@router.get("/insights", response_model=StatsInsightsPublic)
def stats_insights(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    rows = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == current.id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()

    by_hour: defaultdict[int, int] = defaultdict(int)
    by_dow: defaultdict[int, int] = defaultdict(int)
    for r in rows:
        dt = as_utc_aware(r.started_at)
        by_hour[dt.hour] += int(r.duration_seconds or 0)
        by_dow[dt.weekday()] += int(r.duration_seconds or 0)

    best_hour = max(by_hour, key=lambda h: by_hour[h]) if by_hour else None
    dow_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    best_dow = dow_names[max(by_dow, key=lambda d: by_dow[d])] if by_dow else None

    tips: list[str] = []
    if best_hour is not None:
        tips.append(f"Best hour: {best_hour}:00–{(best_hour + 1) % 24}:00 (UTC) for total focus time.")
    if best_dow:
        tips.append(f"You lean toward {best_dow}s for volume.")

    week_key = _monday(utcnow().date())
    goal = db.scalar(
        select(UserGoal).where(
            UserGoal.user_id == current.id,
            UserGoal.goal_type == "weekly_sessions",
            UserGoal.week_start == week_key,
        )
    )
    week_sessions = len([r for r in rows if _monday(as_utc_aware(r.started_at).date()) == week_key])
    target = goal.target_value if goal else None
    met = bool(goal and target and week_sessions >= target)

    return StatsInsightsPublic(
        productivity=ProductivityInsightsPublic(
            best_hour_start=best_hour,
            best_weekday=best_dow,
            tips=tips,
        ),
        weekly_goal_sessions=week_sessions if goal else None,
        weekly_goal_target=target,
        weekly_goal_met=met if goal else None,
    )


@router.get("/records", response_model=PersonalRecordsPublic)
def stats_records(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    rows = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == current.id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()

    records: list[PersonalRecordItem] = []

    if rows:
        longest = max(rows, key=lambda r: int(r.duration_seconds or 0))
        ds = int(longest.duration_seconds or 0)
        if ds >= 3600:
            val = f"{ds // 3600}h {(ds % 3600) // 60}m"
        else:
            val = f"{ds // 60} min"
        records.append(
            PersonalRecordItem(
                key="longest_session",
                label="Longest session",
                value=val,
                context=longest.session_type,
                occurred_at=as_utc_aware(longest.started_at).date().isoformat(),
            )
        )

    by_day: defaultdict[str, list[ProductionSession]] = defaultdict(list)
    for r in rows:
        by_day[as_utc_aware(r.started_at).date().isoformat()].append(r)
    if by_day:
        best_day = max(by_day, key=lambda k: len(by_day[k]))
        n = len(by_day[best_day])
        records.append(
            PersonalRecordItem(
                key="most_sessions_day",
                label="Most sessions in one day",
                value=f"{n} sessions",
                context=best_day,
                occurred_at=best_day,
            )
        )

    session_days = [as_utc_aware(r.started_at).date().isoformat() for r in rows]
    streak_row = db.scalar(select(Streak).where(Streak.user_id == current.id))
    frozen = parse_frozen_json(streak_row.frozen_day_keys) if streak_row else []
    merged = list(set(session_days) | set(frozen))
    best = best_streak_run(merged)
    cur = compute_current_streak(merged)
    records.append(
        PersonalRecordItem(
            key="longest_streak",
            label="Longest streak",
            value=f"{best} days",
            context="All-time",
            occurred_at=None,
        )
    )
    records.append(
        PersonalRecordItem(
            key="current_streak",
            label="Current streak",
            value=f"{cur} days",
            context="Now",
            occurred_at=None,
        )
    )

    week_tot: defaultdict[str, int] = defaultdict(int)
    for r in rows:
        wk = _monday(as_utc_aware(r.started_at).date())
        week_tot[wk] += int(r.duration_seconds or 0)
    if week_tot:
        top_wk = max(week_tot, key=lambda w: week_tot[w])
        sec = week_tot[top_wk]
        records.append(
            PersonalRecordItem(
                key="productive_week",
                label="Most productive week",
                value=f"{sec // 3600}h {(sec % 3600) // 60}m total",
                context=f"Week of {top_wk}",
                occurred_at=top_wk,
            )
        )

    return PersonalRecordsPublic(records=records)


@router.get("/heatmap", response_model=HeatmapPublic)
def stats_heatmap(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    today = utcnow().date()
    start = today - timedelta(days=89)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)

    rows = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == current.id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.started_at >= start_dt,
        )
    ).all()

    by_day: defaultdict[str, int] = defaultdict(int)
    for r in rows:
        k = as_utc_aware(r.started_at).date().isoformat()
        by_day[k] += int(r.duration_seconds or 0)

    out: list[HeatmapDayPublic] = []
    for i in range(90):
        d = start + timedelta(days=i)
        ds = d.isoformat()
        sec = by_day.get(ds, 0)
        if sec <= 0:
            lvl = 0
        elif sec < 1800:
            lvl = 1
        elif sec < 7200:
            lvl = 2
        elif sec < 18000:
            lvl = 3
        else:
            lvl = 4
        out.append(HeatmapDayPublic(date=ds, seconds=sec, intensity=lvl))

    return HeatmapPublic(days=out)
