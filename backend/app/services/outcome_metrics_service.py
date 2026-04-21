from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, load_only

from app.models import ProductionSession, User, utcnow
from app.timeutil import as_utc_aware


@dataclass
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


def _safe_pct_change(current: int, previous: int) -> float:
    if previous <= 0:
        return 100.0 if current > 0 else 0.0
    return ((current - previous) / previous) * 100.0


class OutcomeMetricsService:
    @staticmethod
    def calculate(user_id: int, db: Session) -> OutputMetricsResult:
        now = utcnow()
        start_30 = now - timedelta(days=30)
        start_60 = now - timedelta(days=60)
        start_90 = now - timedelta(days=90)
        # Bounded window for row payloads; lifetime aggregates use COUNT queries below.
        start_load = start_60

        sessions = db.scalars(
            select(ProductionSession)
            .where(
                ProductionSession.user_id == user_id,
                ProductionSession.deleted_at.is_(None),
                ProductionSession.duration_seconds.is_not(None),
                ProductionSession.started_at >= start_load,
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

        current_rows = [r for r in sessions if as_utc_aware(r.started_at) >= start_30]
        previous_rows = [r for r in sessions if start_60 <= as_utc_aware(r.started_at) < start_30]
        rows_90 = [r for r in sessions if as_utc_aware(r.started_at) >= start_90]

        current_finished = [r for r in current_rows if r.track_outcome == "finished"]
        previous_finished = [r for r in previous_rows if r.track_outcome == "finished"]

        tracks_finished_30d = len(current_finished)
        prev_finished_count = len(previous_finished)
        vs_previous_month = round(_safe_pct_change(tracks_finished_30d, prev_finished_count), 1)

        completion_days: list[float] = []
        by_title = [r for r in sessions if (r.track_title or "").strip()]
        by_title.sort(key=lambda r: as_utc_aware(r.started_at))
        first_seen_by_title: dict[str, ProductionSession] = {}
        for row in by_title:
            title = (row.track_title or "").strip().lower()
            if not title:
                continue
            if title not in first_seen_by_title and row.track_outcome in ("wip", "finished"):
                first_seen_by_title[title] = row
            if row.track_outcome == "finished" and title in first_seen_by_title:
                first = first_seen_by_title[title]
                delta_days = max(
                    1.0, (as_utc_aware(row.started_at) - as_utc_aware(first.started_at)).total_seconds() / 86400.0
                )
                completion_days.append(delta_days)
                del first_seen_by_title[title]
        avg_completion = round(sum(completion_days) / len(completion_days), 1) if completion_days else 0.0

        active_days_90 = len({as_utc_aware(r.started_at).date().isoformat() for r in rows_90})

        release_consistency = round(min(100.0, (active_days_90 / 90.0) * 100.0), 1)

        if vs_previous_month > 10:
            trend = "up"
        elif vs_previous_month < -10:
            trend = "down"
        else:
            trend = "stable"

        user = db.get(User, user_id)
        days_using = 0
        if user is not None:
            days_using = max(1, (now.date() - as_utc_aware(user.created_at).date()).days + 1)

        all_finished_count = int(
            db.scalar(
                select(func.count())
                .select_from(ProductionSession)
                .where(
                    ProductionSession.user_id == user_id,
                    ProductionSession.deleted_at.is_(None),
                    ProductionSession.duration_seconds.is_not(None),
                    ProductionSession.track_outcome == "finished",
                )
            )
            or 0
        )

        baseline_finished = 0
        if user is not None:
            start = as_utc_aware(user.created_at)
            baseline_end = start + timedelta(days=30)
            baseline_finished = int(
                db.scalar(
                    select(func.count())
                    .select_from(ProductionSession)
                    .where(
                        ProductionSession.user_id == user_id,
                        ProductionSession.deleted_at.is_(None),
                        ProductionSession.duration_seconds.is_not(None),
                        ProductionSession.track_outcome == "finished",
                        ProductionSession.started_at >= start,
                        ProductionSession.started_at < baseline_end,
                    )
                )
                or 0
            )
        output_increase = round(_safe_pct_change(tracks_finished_30d, baseline_finished), 1)
        consistency_improvement = round(
            max(-100.0, min(200.0, ((release_consistency - 30.0) / 30.0) * 100.0)),
            1,
        )

        return OutputMetricsResult(
            tracks_finished_30d=tracks_finished_30d,
            avg_completion_time_days=avg_completion,
            release_consistency=release_consistency,
            productivity_trend=trend,
            vs_previous_month=vs_previous_month,
            days_using=days_using,
            completed_tracks=all_finished_count,
            consistency_improvement=consistency_improvement,
            output_increase=output_increase,
            baseline_tracks_30d=baseline_finished,
        )
