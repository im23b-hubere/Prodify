from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.orm import Session

from app.models import ProductionSession, utcnow


def current_week_start() -> str:
    today = utcnow().date()
    return (today - timedelta(days=today.weekday())).isoformat()


def previous_week_start() -> str:
    today = utcnow().date()
    current_start = today - timedelta(days=today.weekday())
    return (current_start - timedelta(days=7)).isoformat()


def session_count(db: Session, user_id: int, week_start: str) -> int:
    week_range = _parse_week_range(week_start)
    if week_range is None:
        return 0
    start, end = week_range
    return int(
        db.scalar(
            select(func.count())
            .select_from(ProductionSession)
            .where(*_completed_session_filters(start, end), ProductionSession.user_id == user_id)
        )
        or 0
    )


def session_counts(db: Session, user_ids: list[int], week_start: str) -> dict[int, int]:
    if not user_ids:
        return {}
    week_range = _parse_week_range(week_start)
    if week_range is None:
        return dict.fromkeys(user_ids, 0)
    start, end = week_range
    rows = db.execute(
        select(ProductionSession.user_id, func.count())
        .where(*_completed_session_filters(start, end), ProductionSession.user_id.in_(user_ids))
        .group_by(ProductionSession.user_id)
    ).all()
    counts = {int(user_id): int(count) for user_id, count in rows}
    return {user_id: counts.get(user_id, 0) for user_id in user_ids}


def _parse_week_range(week_start: str) -> tuple[datetime, datetime] | None:
    try:
        start = datetime.fromisoformat(week_start).replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    return start, start + timedelta(days=7)


def _completed_session_filters(start: datetime, end: datetime) -> tuple[ColumnElement[bool], ...]:
    return (
        ProductionSession.deleted_at.is_(None),
        ProductionSession.duration_seconds.is_not(None),
        ProductionSession.started_at >= start,
        ProductionSession.started_at < end,
    )
