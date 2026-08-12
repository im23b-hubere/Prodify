from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, load_only

from app.models import ProductionSession, User, utcnow
from app.timeutil import as_utc_aware


@dataclass(frozen=True)
class OutputMetricsResult:
    tracks_finished_30d: int
    avg_completion_time_days: float
    release_consistency: float
    productivity_trend: str
    vs_previous_month: float
    days_using: int
    completed_tracks: int
    consistency_improvement: float
    output_increase: float
    baseline_tracks_30d: int


@dataclass(frozen=True)
class MetricWindows:
    now: datetime
    current_start: datetime
    previous_start: datetime
    activity_start: datetime

    @classmethod
    def ending_now(cls) -> "MetricWindows":
        now = utcnow()
        return cls(
            now=now,
            current_start=now - timedelta(days=30),
            previous_start=now - timedelta(days=60),
            activity_start=now - timedelta(days=90),
        )


def _safe_pct_change(current: int, previous: int) -> float:
    if previous <= 0:
        return 100.0 if current > 0 else 0.0
    return ((current - previous) / previous) * 100.0


class OutcomeMetricsService:
    @staticmethod
    def calculate(user_id: int, db: Session) -> OutputMetricsResult:
        windows = MetricWindows.ending_now()
        sessions = _load_metric_sessions(db, user_id, windows.activity_start)
        current, previous = _monthly_periods(sessions, windows)
        current_finished = _finished_count(current)
        previous_finished = _finished_count(previous)
        month_change = round(_safe_pct_change(current_finished, previous_finished), 1)
        active_days = len({_session_date(row) for row in sessions})
        consistency = round(min(100.0, active_days / 90.0 * 100.0), 1)
        user = db.get(User, user_id)
        baseline = _baseline_finished_count(db, user_id, user)

        return OutputMetricsResult(
            tracks_finished_30d=current_finished,
            avg_completion_time_days=_average_completion_days(sessions),
            release_consistency=consistency,
            productivity_trend=_productivity_trend(month_change),
            vs_previous_month=month_change,
            days_using=_days_using(user, windows.now),
            completed_tracks=_all_finished_count(db, user_id),
            consistency_improvement=round(
                max(-100.0, min(200.0, (consistency - 30.0) / 30.0 * 100.0)),
                1,
            ),
            output_increase=round(_safe_pct_change(current_finished, baseline), 1),
            baseline_tracks_30d=baseline,
        )


def _load_metric_sessions(
    db: Session,
    user_id: int,
    since: datetime,
) -> list[ProductionSession]:
    return list(
        db.scalars(
            select(ProductionSession)
            .where(
                ProductionSession.user_id == user_id,
                ProductionSession.deleted_at.is_(None),
                ProductionSession.duration_seconds.is_not(None),
                ProductionSession.started_at >= since,
            )
            .options(
                load_only(
                    ProductionSession.id,
                    ProductionSession.started_at,
                    ProductionSession.track_outcome,
                    ProductionSession.track_title,
                )
            )
        ).all()
    )


def _monthly_periods(
    sessions: list[ProductionSession],
    windows: MetricWindows,
) -> tuple[list[ProductionSession], list[ProductionSession]]:
    current = [row for row in sessions if as_utc_aware(row.started_at) >= windows.current_start]
    previous = [
        row
        for row in sessions
        if windows.previous_start <= as_utc_aware(row.started_at) < windows.current_start
    ]
    return current, previous


def _average_completion_days(sessions: list[ProductionSession]) -> float:
    first_seen: dict[str, ProductionSession] = {}
    completion_days: list[float] = []
    titled_sessions = sorted(
        (row for row in sessions if (row.track_title or "").strip()),
        key=lambda row: as_utc_aware(row.started_at),
    )
    for row in titled_sessions:
        title = (row.track_title or "").strip().lower()
        if title not in first_seen and row.track_outcome in ("wip", "finished"):
            first_seen[title] = row
        if row.track_outcome != "finished" or title not in first_seen:
            continue
        first = first_seen.pop(title)
        elapsed = (as_utc_aware(row.started_at) - as_utc_aware(first.started_at)).total_seconds()
        completion_days.append(max(1.0, elapsed / 86400.0))
    return round(sum(completion_days) / len(completion_days), 1) if completion_days else 0.0


def _finished_count(sessions: list[ProductionSession]) -> int:
    return sum(1 for row in sessions if row.track_outcome == "finished")


def _all_finished_count(db: Session, user_id: int) -> int:
    return _finished_query(db, user_id)


def _baseline_finished_count(db: Session, user_id: int, user: User | None) -> int:
    if user is None:
        return 0
    start = as_utc_aware(user.created_at)
    return _finished_query(db, user_id, start=start, end=start + timedelta(days=30))


def _finished_query(
    db: Session,
    user_id: int,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
) -> int:
    query = select(func.count()).select_from(ProductionSession).where(
        ProductionSession.user_id == user_id,
        ProductionSession.deleted_at.is_(None),
        ProductionSession.duration_seconds.is_not(None),
        ProductionSession.track_outcome == "finished",
    )
    if start is not None:
        query = query.where(ProductionSession.started_at >= start)
    if end is not None:
        query = query.where(ProductionSession.started_at < end)
    return int(db.scalar(query) or 0)


def _days_using(user: User | None, now: datetime) -> int:
    if user is None:
        return 0
    return max(1, (now.date() - as_utc_aware(user.created_at).date()).days + 1)


def _productivity_trend(month_change: float) -> str:
    if month_change > 10:
        return "up"
    if month_change < -10:
        return "down"
    return "stable"


def _session_date(session: ProductionSession) -> str:
    return as_utc_aware(session.started_at).date().isoformat()
