from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, load_only

from app.models import ProductionSession, Streak, User
from app.timeutil import as_utc_aware


@dataclass(frozen=True)
class ReliabilityScoreResult:
    score: float
    trend: str
    rank_percent: int | None
    consistency_90d: float
    completion_rate_90d: float


@dataclass(frozen=True)
class ReliabilityMetrics:
    active_days: int
    session_count: int
    completed_sessions: int
    current_streak: int

    @property
    def consistency(self) -> float:
        return min(self.active_days / 90.0, 1.0)

    @property
    def completion_rate(self) -> float:
        return self.completed_sessions / self.session_count if self.session_count else 0.0

    @property
    def score(self) -> float:
        streak_component = min(self.current_streak / 30.0, 1.0)
        weighted = self.consistency * 0.45 + self.completion_rate * 0.35 + streak_component * 0.20
        return round(max(0.0, min(weighted * 10.0, 10.0)), 1)


class ReliabilityScoreService:
    """Compute a transparent 0.0-10.0 reliability score."""

    @staticmethod
    def calculate(user_id: int, db: Session) -> ReliabilityScoreResult:
        current_start = datetime.now(timezone.utc) - timedelta(days=90)
        previous_start = current_start - timedelta(days=90)
        current_sessions = _load_sessions(db, user_id, current_start)
        previous_sessions = _load_sessions(db, user_id, previous_start, current_start)
        current = _metrics_for_user(db, user_id, current_sessions)
        previous_active_days = len(_active_days(previous_sessions))

        return ReliabilityScoreResult(
            score=current.score,
            trend=_trend(current.active_days, previous_active_days),
            rank_percent=_rank_percent(db, user_id, current.score, current_start),
            consistency_90d=round(current.consistency * 100.0, 1),
            completion_rate_90d=round(current.completion_rate * 100.0, 1),
        )


def _load_sessions(
    db: Session,
    user_id: int,
    start: datetime,
    end: datetime | None = None,
) -> list[ProductionSession]:
    query = select(ProductionSession).where(
        ProductionSession.user_id == user_id,
        ProductionSession.deleted_at.is_(None),
        ProductionSession.duration_seconds.is_not(None),
        ProductionSession.started_at >= start,
    )
    if end is not None:
        query = query.where(ProductionSession.started_at < end)
    return list(
        db.scalars(
            query.options(
                load_only(
                    ProductionSession.started_at,
                    ProductionSession.duration_seconds,
                )
            )
        ).all()
    )


def _metrics_for_user(
    db: Session,
    user_id: int,
    sessions: list[ProductionSession],
) -> ReliabilityMetrics:
    streak = db.scalar(select(Streak.current_streak).where(Streak.user_id == user_id))
    return ReliabilityMetrics(
        active_days=len(_active_days(sessions)),
        session_count=len(sessions),
        completed_sessions=sum(_is_completed(row.duration_seconds) for row in sessions),
        current_streak=int(streak or 0),
    )


def _active_days(sessions: list[ProductionSession]) -> set[str]:
    return {as_utc_aware(row.started_at).date().isoformat() for row in sessions}


def _is_completed(duration_seconds: int | None) -> bool:
    """A productive session of at least 25 minutes counts as completed."""
    return int(duration_seconds or 0) >= 1500


def _trend(current_active_days: int, previous_active_days: int) -> str:
    difference = current_active_days - previous_active_days
    if difference >= 5:
        return "up"
    if difference <= -5:
        return "down"
    return "stable"


def _rank_percent(
    db: Session,
    user_id: int,
    user_score: float,
    since: datetime,
) -> int | None:
    user_ids = list(db.scalars(select(User.id)).all())
    if len(user_ids) < 5:
        return None

    scores = _cohort_scores(db, user_ids, since)
    scores[user_id] = user_score
    ordered_scores = sorted(scores.values(), reverse=True)
    rank_position = ordered_scores.index(user_score) + 1
    return max(1, int(rank_position / len(ordered_scores) * 100))


def _cohort_scores(db: Session, user_ids: list[int], since: datetime) -> dict[int, float]:
    streaks = {
        user_id: int(streak or 0)
        for user_id, streak in db.execute(select(Streak.user_id, Streak.current_streak)).all()
    }
    metrics = {user_id: ReliabilityMetrics(0, 0, 0, streaks.get(user_id, 0)) for user_id in user_ids}
    days_by_user: dict[int, set[str]] = {user_id: set() for user_id in user_ids}

    for user_id, started_at, duration in _cohort_sessions(db, since):
        previous = metrics[user_id]
        days_by_user[user_id].add(as_utc_aware(started_at).date().isoformat())
        metrics[user_id] = ReliabilityMetrics(
            active_days=len(days_by_user[user_id]),
            session_count=previous.session_count + 1,
            completed_sessions=previous.completed_sessions + int(_is_completed(duration)),
            current_streak=previous.current_streak,
        )
    return {user_id: metric.score for user_id, metric in metrics.items()}


def _cohort_sessions(db: Session, since: datetime) -> list[tuple[int, datetime, int | None]]:
    return list(
        db.execute(
            select(
                ProductionSession.user_id,
                ProductionSession.started_at,
                ProductionSession.duration_seconds,
            ).where(
                ProductionSession.deleted_at.is_(None),
                ProductionSession.duration_seconds.is_not(None),
                ProductionSession.started_at >= since,
            )
        ).tuples()
    )
