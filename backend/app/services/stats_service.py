from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, load_only

from app.contracts.insights import (
    HeatmapDayPublic,
    HeatmapPublic,
    PersonalRecordItem,
    PersonalRecordsPublic,
    ProductivityInsightsPublic,
    StatsInsightsPublic,
)
from app.contracts.sessions import InsightItemPublic
from app.models import ProductionSession, Streak, UserGoal, utcnow
from app.streakutil import best_streak_run, compute_current_streak, parse_frozen_json
from app.timeutil import as_utc_aware


def build_stats_insights(db: Session, user_id: int) -> StatsInsightsPublic:
    sessions = _completed_sessions(db, user_id)
    best_hour, best_weekday = _productive_time_slots(sessions)
    week_start = _monday(utcnow().date())
    target = _weekly_goal_target(db, user_id, week_start)
    week_sessions = sum(
        _monday(as_utc_aware(row.started_at).date()) == week_start for row in sessions
    )
    return StatsInsightsPublic(
        productivity=ProductivityInsightsPublic(
            best_hour_start=best_hour,
            best_weekday=None,
            best_weekday_index=best_weekday,
            tips=[],
            tip_items=_insight_items(best_hour, best_weekday),
        ),
        weekly_goal_sessions=week_sessions if target is not None else None,
        weekly_goal_target=target,
        weekly_goal_met=bool(target and week_sessions >= target) if target is not None else None,
    )


def build_personal_records(db: Session, user_id: int) -> PersonalRecordsPublic:
    sessions = _completed_sessions(db, user_id)
    records: list[PersonalRecordItem] = []
    longest_session = _longest_session_record(sessions)
    busiest_day = _busiest_day_record(sessions)
    productive_week = _productive_week_record(sessions)
    records.extend(record for record in (longest_session, busiest_day) if record is not None)
    records.extend(_streak_records(db, user_id, sessions))
    if productive_week is not None:
        records.append(productive_week)
    return PersonalRecordsPublic(records=records)


def build_heatmap(db: Session, user_id: int) -> HeatmapPublic:
    today = utcnow().date()
    start = today - timedelta(days=89)
    sessions = _completed_sessions(
        db,
        user_id,
        since=datetime.combine(start, time.min, tzinfo=timezone.utc),
    )
    seconds_by_day: defaultdict[str, int] = defaultdict(int)
    for session in sessions:
        day = as_utc_aware(session.started_at).date().isoformat()
        seconds_by_day[day] += int(session.duration_seconds or 0)
    days: list[HeatmapDayPublic] = []
    for offset in range(90):
        day = (start + timedelta(days=offset)).isoformat()
        seconds = seconds_by_day[day]
        days.append(HeatmapDayPublic(date=day, seconds=seconds, intensity=_heatmap_intensity(seconds)))
    return HeatmapPublic(days=days)


def _completed_sessions(
    db: Session,
    user_id: int,
    *,
    since: datetime | None = None,
) -> list[ProductionSession]:
    query = select(ProductionSession).where(
        ProductionSession.user_id == user_id,
        ProductionSession.deleted_at.is_(None),
        ProductionSession.duration_seconds.is_not(None),
    )
    if since is not None:
        query = query.where(ProductionSession.started_at >= since)
    return list(
        db.scalars(
            query.options(
                load_only(
                    ProductionSession.started_at,
                    ProductionSession.duration_seconds,
                    ProductionSession.session_type,
                )
            )
        ).all()
    )


def _productive_time_slots(sessions: list[ProductionSession]) -> tuple[int | None, int | None]:
    seconds_by_hour: defaultdict[int, int] = defaultdict(int)
    seconds_by_weekday: defaultdict[int, int] = defaultdict(int)
    for session in sessions:
        started_at = as_utc_aware(session.started_at)
        duration = int(session.duration_seconds or 0)
        seconds_by_hour[started_at.hour] += duration
        seconds_by_weekday[started_at.weekday()] += duration
    best_hour = max(seconds_by_hour, key=seconds_by_hour.get) if seconds_by_hour else None
    best_weekday = max(seconds_by_weekday, key=seconds_by_weekday.get) if seconds_by_weekday else None
    return best_hour, best_weekday


def _weekly_goal_target(db: Session, user_id: int, week_start: str) -> int | None:
    target = db.scalar(
        select(UserGoal.target_value).where(
            UserGoal.user_id == user_id,
            UserGoal.goal_type == "weekly_sessions",
            UserGoal.week_start == week_start,
        )
    )
    return int(target) if target is not None else None


def _insight_items(best_hour: int | None, best_weekday: int | None) -> list[InsightItemPublic]:
    items: list[InsightItemPublic] = []
    if best_hour is not None:
        items.append(InsightItemPublic(key="stats_insights_best_hour", params={"hour": best_hour}))
    if best_weekday is not None:
        items.append(InsightItemPublic(key="stats_insights_lean_dow", params={"weekday": best_weekday}))
    return items


def _longest_session_record(sessions: list[ProductionSession]) -> PersonalRecordItem | None:
    if not sessions:
        return None
    session = max(sessions, key=lambda row: int(row.duration_seconds or 0))
    duration = int(session.duration_seconds or 0)
    value = f"{duration // 3600}h {(duration % 3600) // 60}m" if duration >= 3600 else f"{duration // 60} min"
    return PersonalRecordItem(
        key="longest_session",
        label="Longest session",
        value=value,
        context=session.session_type,
        occurred_at=as_utc_aware(session.started_at).date().isoformat(),
    )


def _busiest_day_record(sessions: list[ProductionSession]) -> PersonalRecordItem | None:
    sessions_by_day: defaultdict[str, int] = defaultdict(int)
    for session in sessions:
        sessions_by_day[as_utc_aware(session.started_at).date().isoformat()] += 1
    if not sessions_by_day:
        return None
    day = max(sessions_by_day, key=sessions_by_day.get)
    return PersonalRecordItem(
        key="most_sessions_day",
        label="Most sessions in one day",
        value=f"{sessions_by_day[day]} sessions",
        context=day,
        occurred_at=day,
    )


def _streak_records(
    db: Session,
    user_id: int,
    sessions: list[ProductionSession],
) -> list[PersonalRecordItem]:
    session_days = {as_utc_aware(row.started_at).date().isoformat() for row in sessions}
    frozen_json = db.scalar(select(Streak.frozen_day_keys).where(Streak.user_id == user_id))
    frozen_days = set(parse_frozen_json(frozen_json)) if frozen_json else set()
    all_days = list(session_days | frozen_days)
    return [
        PersonalRecordItem(key="longest_streak", label="Longest streak", value=f"{best_streak_run(all_days)} days", context="All-time", occurred_at=None),
        PersonalRecordItem(key="current_streak", label="Current streak", value=f"{compute_current_streak(all_days)} days", context="Now", occurred_at=None),
    ]


def _productive_week_record(sessions: list[ProductionSession]) -> PersonalRecordItem | None:
    seconds_by_week: defaultdict[str, int] = defaultdict(int)
    for session in sessions:
        seconds_by_week[_monday(as_utc_aware(session.started_at).date())] += int(session.duration_seconds or 0)
    if not seconds_by_week:
        return None
    week = max(seconds_by_week, key=seconds_by_week.get)
    seconds = seconds_by_week[week]
    return PersonalRecordItem(
        key="productive_week",
        label="Most productive week",
        value=f"{seconds // 3600}h {(seconds % 3600) // 60}m total",
        context=f"Week of {week}",
        occurred_at=week,
    )


def _heatmap_intensity(seconds: int) -> int:
    if seconds <= 0:
        return 0
    if seconds < 1800:
        return 1
    if seconds < 7200:
        return 2
    if seconds < 18000:
        return 3
    return 4


def _monday(day: date) -> str:
    return (day - timedelta(days=day.weekday())).isoformat()
