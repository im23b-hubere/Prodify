"""Aggregated session and streak data used by friend-facing views."""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ProductionSession, Streak


def session_counts_since(
    db: Session,
    user_ids: list[int],
    since: datetime,
) -> dict[int, int]:
    return _session_counts(db, user_ids, since=since)


def session_counts_between(
    db: Session,
    user_ids: list[int],
    since: datetime,
    until: datetime,
) -> dict[int, int]:
    return _session_counts(db, user_ids, since=since, until=until)


def _session_counts(
    db: Session,
    user_ids: list[int],
    *,
    since: datetime,
    until: datetime | None = None,
) -> dict[int, int]:
    if not user_ids:
        return {}

    query = select(ProductionSession.user_id, func.count(ProductionSession.id)).where(
        ProductionSession.user_id.in_(user_ids),
        ProductionSession.deleted_at.is_(None),
        ProductionSession.duration_seconds.is_not(None),
        ProductionSession.started_at >= since,
    )
    if until is not None:
        query = query.where(ProductionSession.started_at < until)

    rows = db.execute(query.group_by(ProductionSession.user_id)).all()
    return {int(user_id): int(count) for user_id, count in rows}


def streak_by_user(db: Session, user_id: int) -> Streak | None:
    return db.scalar(select(Streak).where(Streak.user_id == user_id))
