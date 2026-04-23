from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ProductionSession, Streak, User
from app.timeutil import as_utc_aware


@dataclass
class ReliabilityScoreResult:
    score: float
    trend: str
    rank_percent: int | None
    consistency_90d: float
    completion_rate_90d: float


class ReliabilityScoreService:
    """Compute a transparent 0.0-10.0 reliability score."""

    @staticmethod
    def calculate(user_id: int, db: Session) -> ReliabilityScoreResult:
        now = datetime.now(timezone.utc)
        start_90d = now - timedelta(days=90)
        start_prev_90d = now - timedelta(days=180)

        current_sessions = db.scalars(
            select(ProductionSession).where(
                ProductionSession.user_id == user_id,
                ProductionSession.deleted_at.is_(None),
                ProductionSession.duration_seconds.is_not(None),
                ProductionSession.started_at >= start_90d,
            )
        ).all()
        previous_sessions = db.scalars(
            select(ProductionSession).where(
                ProductionSession.user_id == user_id,
                ProductionSession.deleted_at.is_(None),
                ProductionSession.duration_seconds.is_not(None),
                ProductionSession.started_at >= start_prev_90d,
                ProductionSession.started_at < start_90d,
            )
        ).all()

        day_keys_current = {as_utc_aware(s.started_at).date().isoformat() for s in current_sessions}
        day_keys_previous = {as_utc_aware(s.started_at).date().isoformat() for s in previous_sessions}

        active_days_90d = len(day_keys_current)
        active_days_prev_90d = len(day_keys_previous)
        consistency_90d = min(active_days_90d / 90.0, 1.0)

        # "Completion" proxy: sessions that reached at least 25 productive minutes.
        completed_sessions = len([s for s in current_sessions if int(s.duration_seconds or 0) >= 1500])
        completion_rate_90d = (
            completed_sessions / len(current_sessions) if current_sessions else 0.0
        )

        streak_row = db.scalar(select(Streak).where(Streak.user_id == user_id))
        current_streak = int(streak_row.current_streak or 0) if streak_row else 0
        streak_component = min(current_streak / 30.0, 1.0)

        weighted = (
            consistency_90d * 0.45
            + completion_rate_90d * 0.35
            + streak_component * 0.20
        )
        score = round(max(0.0, min(weighted * 10.0, 10.0)), 1)

        trend_diff = active_days_90d - active_days_prev_90d
        if trend_diff >= 5:
            trend = "up"
        elif trend_diff <= -5:
            trend = "down"
        else:
            trend = "stable"

        all_user_ids = db.scalars(select(User.id)).all()
        rank_percent: int | None = None
        # Avoid misleading percentile messaging with tiny cohorts.
        if len(all_user_ids) >= 5:
            streak_map = {
                row.user_id: int(row.current_streak or 0)
                for row in db.scalars(select(Streak)).all()
            }
            session_rows = db.execute(
                select(
                    ProductionSession.user_id,
                    ProductionSession.started_at,
                    ProductionSession.duration_seconds,
                ).where(
                    ProductionSession.deleted_at.is_(None),
                    ProductionSession.duration_seconds.is_not(None),
                    ProductionSession.started_at >= start_90d,
                )
            ).all()
            by_user_days: dict[int, set[str]] = {}
            by_user_total_sessions: dict[int, int] = {}
            by_user_completed_sessions: dict[int, int] = {}
            for uid, started_at, duration_seconds in session_rows:
                if uid not in by_user_days:
                    by_user_days[uid] = set()
                    by_user_total_sessions[uid] = 0
                    by_user_completed_sessions[uid] = 0
                by_user_days[uid].add(as_utc_aware(started_at).date().isoformat())
                by_user_total_sessions[uid] += 1
                if int(duration_seconds or 0) >= 1500:
                    by_user_completed_sessions[uid] += 1

            scores: list[float] = []
            for uid in all_user_ids:
                if uid == user_id:
                    scores.append(score)
                    continue
                consistency = min(len(by_user_days.get(uid, set())) / 90.0, 1.0)
                total_sessions = by_user_total_sessions.get(uid, 0)
                completion = (
                    by_user_completed_sessions.get(uid, 0) / total_sessions if total_sessions else 0.0
                )
                streak_component = min(streak_map.get(uid, 0) / 30.0, 1.0)
                scores.append(
                    round(
                        max(
                            0.0,
                            min(
                                (consistency * 0.45 + completion * 0.35 + streak_component * 0.20) * 10.0,
                                10.0,
                            ),
                        ),
                        1,
                    )
                )
            scores.sort(reverse=True)
            total = max(len(scores), 1)
            rank_position = scores.index(score) + 1 if score in scores else total
            rank_percent = max(1, int((rank_position / total) * 100))

        return ReliabilityScoreResult(
            score=score,
            trend=trend,
            rank_percent=rank_percent,
            consistency_90d=round(consistency_90d * 100.0, 1),
            completion_rate_90d=round(completion_rate_90d * 100.0, 1),
        )

