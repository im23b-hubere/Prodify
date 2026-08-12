from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.achievementsutil import session_focus_metrics
from app.models import ProductionSession, Streak, UserGoal, utcnow
from app.schemas import (
    InsightItemPublic,
    RelatedSessionPublic,
    SessionDetailInsightsPublic,
    SessionPublic,
    SessionStatsPublic,
    SessionStatsSummary,
    SessionStatsTrendPoint,
    SessionStatsTypeBreakdownItem,
    SessionTimelineSegmentPublic,
)
from app.streakutil import best_streak_run, compute_current_streak, parse_frozen_json
from app.timeutil import as_utc_aware

_DURATION_CAP_SECONDS = 48 * 3600


@dataclass(frozen=True)
class StatsPeriod:
    label: str
    days: int | None

    @classmethod
    def parse(cls, value: str) -> "StatsPeriod":
        if value in ("30d", "month"):
            return cls("month", 30)
        if value == "all":
            return cls("all", None)
        return cls("week", 7)


def build_session_stats(db: Session, user_id: int, requested_period: str) -> SessionStatsPublic:
    period = StatsPeriod.parse(requested_period)
    period_start = utcnow() - timedelta(days=period.days) if period.days is not None else None
    sessions = _load_completed_sessions(db, user_id, since=period_start)
    total_seconds = sum(_bounded_duration(row) for row in sessions)
    streak_days = _streak_days(db, user_id)
    return SessionStatsPublic(
        period=period.label,
        summary=SessionStatsSummary(
            total_seconds=total_seconds,
            total_sessions=len(sessions),
            best_streak_days=best_streak_run(streak_days),
            avg_session_seconds=int(total_seconds / len(sessions)) if sessions else 0,
            current_streak_days=compute_current_streak(streak_days),
            hours_delta_vs_prior_period=_hours_delta(db, user_id, period, period_start, total_seconds),
        ),
        trend=_session_trend(sessions),
        breakdown=_type_breakdown(sessions),
        recent_sessions=[SessionPublic.model_validate(row) for row in reversed(sessions[-10:])],
        productivity_hint=None,
        productivity_hint_item=productivity_hint(sessions),
    )


def _load_completed_sessions(
    db: Session,
    user_id: int,
    *,
    since: datetime | None = None,
    until: datetime | None = None,
) -> list[ProductionSession]:
    query = select(ProductionSession).where(
        ProductionSession.user_id == user_id,
        ProductionSession.deleted_at.is_(None),
        ProductionSession.duration_seconds.is_not(None),
    )
    if since is not None:
        query = query.where(ProductionSession.started_at >= since)
    if until is not None:
        query = query.where(ProductionSession.started_at < until)
    return list(db.scalars(query.order_by(ProductionSession.started_at.asc())).all())


def _bounded_duration(session: ProductionSession) -> int:
    return min(int(session.duration_seconds or 0), _DURATION_CAP_SECONDS)


def _streak_days(db: Session, user_id: int) -> list[str]:
    session_dates = db.scalars(
        select(ProductionSession.started_at).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()
    frozen_json = db.scalar(select(Streak.frozen_day_keys).where(Streak.user_id == user_id))
    frozen_days = parse_frozen_json(frozen_json) if frozen_json else []
    active_days = {as_utc_aware(started_at).date().isoformat() for started_at in session_dates}
    return list(active_days | set(frozen_days))


def _hours_delta(
    db: Session,
    user_id: int,
    period: StatsPeriod,
    period_start: datetime | None,
    current_seconds: int,
) -> float | None:
    if period.days is None or period_start is None:
        return None
    previous = _load_completed_sessions(
        db,
        user_id,
        since=period_start - timedelta(days=period.days),
        until=period_start,
    )
    previous_seconds = sum(_bounded_duration(row) for row in previous)
    return round((current_seconds - previous_seconds) / 3600, 1)


def _session_trend(sessions: list[ProductionSession]) -> list[SessionStatsTrendPoint]:
    totals: dict[str, tuple[int, int]] = {}
    for session in sessions:
        day = as_utc_aware(session.started_at).date().isoformat()
        count, seconds = totals.get(day, (0, 0))
        totals[day] = count + 1, seconds + _bounded_duration(session)
    return [
        SessionStatsTrendPoint(label=day, sessions=count, seconds=seconds)
        for day, (count, seconds) in sorted(totals.items())
    ]


def _type_breakdown(sessions: list[ProductionSession]) -> list[SessionStatsTypeBreakdownItem]:
    counts = Counter(str(row.session_type) or "beat_making" for row in sessions)
    items = [
        SessionStatsTypeBreakdownItem(
            session_type=session_type,
            sessions=count,
            percent=count / len(sessions) * 100 if sessions else 0.0,
        )
        for session_type, count in counts.items()
    ]
    return sorted(items, key=lambda item: item.sessions, reverse=True)


def productivity_hint(rows: list[ProductionSession]) -> InsightItemPublic | None:
    """Describe the most frequent weekday/hour pattern once enough data exists."""
    if len(rows) < 10:
        return None

    weekdays = Counter(as_utc_aware(row.started_at).weekday() for row in rows)
    hours = Counter(as_utc_aware(row.started_at).hour for row in rows)
    return InsightItemPublic(
        key="prod_peak_pattern",
        params={
            "weekday": weekdays.most_common(1)[0][0],
            "hour": hours.most_common(1)[0][0],
        },
    )


def build_session_detail_insights(
    db: Session,
    user_id: int,
    session: ProductionSession,
) -> SessionDetailInsightsPublic:
    completed = _load_completed_sessions(db, user_id)
    focus_score, effective_rate = session_focus_metrics(session)
    percentile, average = _focus_comparison(completed, session.id, focus_score)
    paused_seconds = int(session.paused_duration_seconds or 0)
    duration_seconds = int(session.duration_seconds or 0)
    return SessionDetailInsightsPublic(
        impact_lines=[],
        impact_items=_impact_items(db, user_id, session, completed),
        focus_score=focus_score,
        focus_label="",
        focus_tier=_focus_tier(focus_score),
        focus_percentile=percentile,
        focus_user_average=average,
        active_seconds=duration_seconds,
        paused_seconds=paused_seconds,
        effective_rate_percent=effective_rate,
        timeline=_timeline(duration_seconds, paused_seconds),
        productivity_insights=[],
        productivity_items=_productivity_items(completed, paused_seconds),
        related_sessions=_related_sessions(db, user_id, session),
    )


def _focus_comparison(
    sessions: list[ProductionSession],
    session_id: int,
    focus_score: int,
) -> tuple[int | None, int | None]:
    peer_scores = [session_focus_metrics(row)[0] for row in sessions if row.id != session_id]
    if not peer_scores:
        return None, None
    percentile = int(round(100 * sum(score < focus_score for score in peer_scores) / len(peer_scores)))
    average = int(round(sum(peer_scores) / len(peer_scores)))
    return percentile, average


def _impact_items(
    db: Session,
    user_id: int,
    session: ProductionSession,
    completed: list[ProductionSession],
) -> list[InsightItemPublic]:
    items = _streak_impact(db, user_id, session, completed)
    goal_item = _weekly_goal_impact(db, user_id, session, completed)
    if goal_item is not None:
        items.append(goal_item)
    return items or [InsightItemPublic(key="impact_default_momentum", params={})]


def _streak_impact(
    db: Session,
    user_id: int,
    session: ProductionSession,
    completed: list[ProductionSession],
) -> list[InsightItemPublic]:
    frozen_json = db.scalar(select(Streak.frozen_day_keys).where(Streak.user_id == user_id))
    frozen_days = parse_frozen_json(frozen_json) if frozen_json else []
    session_days = {as_utc_aware(row.started_at).date().isoformat() for row in completed}
    current_streak = compute_current_streak(list(session_days | set(frozen_days)))
    is_today = as_utc_aware(session.started_at).date() == utcnow().date()
    if current_streak > 0 and is_today:
        return [InsightItemPublic(key="impact_streak_fuel", params={"days": current_streak})]
    return []


def _weekly_goal_impact(
    db: Session,
    user_id: int,
    session: ProductionSession,
    completed: list[ProductionSession],
) -> InsightItemPublic | None:
    week_start = _week_start(as_utc_aware(session.started_at).date())
    target = db.scalar(
        select(UserGoal.target_value).where(
            UserGoal.user_id == user_id,
            UserGoal.goal_type == "weekly_sessions",
            UserGoal.week_start == week_start,
        )
    )
    if not target or target <= 0:
        return None
    count = sum(_week_start(as_utc_aware(row.started_at).date()) == week_start for row in completed)
    key = "impact_weekly_goal_cleared" if count >= target else "impact_week_progress"
    return InsightItemPublic(key=key, params={"count": count, "target": target})


def _productivity_items(
    completed: list[ProductionSession],
    paused_seconds: int,
) -> list[InsightItemPublic]:
    items: list[InsightItemPublic] = []
    hint = productivity_hint(completed)
    if hint is not None:
        items.append(hint)
    if paused_seconds <= 60:
        items.append(InsightItemPublic(key="prod_minimal_pause", params={}))
    elif paused_seconds > 600:
        items.append(InsightItemPublic(key="prod_long_breaks", params={}))
    return items


def _related_sessions(
    db: Session,
    user_id: int,
    session: ProductionSession,
) -> list[RelatedSessionPublic]:
    rows = db.scalars(
        select(ProductionSession)
        .where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.session_type == session.session_type,
            ProductionSession.id != session.id,
        )
        .order_by(ProductionSession.started_at.desc())
        .limit(4)
    ).all()
    return [
        RelatedSessionPublic(
            id=row.id,
            session_type=row.session_type,
            duration_seconds=row.duration_seconds,
            started_at=row.started_at,
        )
        for row in rows
    ]


def _timeline(duration_seconds: int, paused_seconds: int) -> list[SessionTimelineSegmentPublic]:
    segments: list[SessionTimelineSegmentPublic] = []
    if duration_seconds > 0:
        segments.append(SessionTimelineSegmentPublic(kind="active", seconds=duration_seconds))
    if paused_seconds > 0:
        segments.append(SessionTimelineSegmentPublic(kind="paused", seconds=paused_seconds))
    return segments


def _focus_tier(score: int) -> str:
    if score >= 95:
        return "excellent"
    if score >= 80:
        return "strong"
    if score >= 60:
        return "solid"
    return "room_to_improve"


def _week_start(day: date) -> str:
    return (day - timedelta(days=day.weekday())).isoformat()
