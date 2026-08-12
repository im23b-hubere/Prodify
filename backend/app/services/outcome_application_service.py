from sqlalchemy.orm import Session

from app.contracts.outcomes import (
    GoalForecastPublic,
    OutputMetricsPublic,
    WeeklyReviewPublic,
)
from app.models import utcnow
from app.services.goal_forecast_service import build_goal_forecast
from app.services.kpi_tracker import track_event, track_event_deduped
from app.services.outcome_metrics_service import OutcomeMetricsService
from app.services.weekly_review_service import (
    generate_weekly_review,
    get_current_weekly_review,
)


def current_weekly_review(db: Session, user_id: int) -> WeeklyReviewPublic | None:
    review = get_current_weekly_review(db, user_id)
    if review is not None:
        _track_once(
            db,
            user_id=user_id,
            bucket_key=f"weekly_review_viewed:{review.week_start}",
            event_name="weekly_review_viewed",
            props={"week_start": review.week_start},
        )
    return review


def create_weekly_review(db: Session, user_id: int) -> WeeklyReviewPublic:
    review = generate_weekly_review(db, user_id)
    track_event(db, "weekly_review_generated", user_id, {"week_start": review.week_start})
    db.commit()
    return review


def current_goal_forecast(db: Session, user_id: int) -> GoalForecastPublic:
    forecast = build_goal_forecast(db, user_id)
    _track_once(
        db,
        user_id=user_id,
        bucket_key=f"goal_forecast_seen:{_today_key()}",
        event_name="goal_forecast_seen",
        props={"risk_level": forecast.risk_level},
    )
    return forecast


def current_output_metrics(db: Session, user_id: int) -> OutputMetricsPublic:
    metrics = OutcomeMetricsService.calculate(user_id, db)
    _track_once(
        db,
        user_id=user_id,
        bucket_key=f"outcome_metrics_viewed:{_today_key()}",
        event_name="outcome_metrics_viewed",
        props={
            "trend": metrics.productivity_trend,
            "tracks_finished_30d": metrics.tracks_finished_30d,
        },
    )
    return OutputMetricsPublic(
        tracks_finished_30d=metrics.tracks_finished_30d,
        avg_completion_time_days=metrics.avg_completion_time_days,
        release_consistency=metrics.release_consistency,
        productivity_trend=metrics.productivity_trend,  # type: ignore[arg-type]
        vs_previous_month=metrics.vs_previous_month,
        days_using=metrics.days_using,
        completed_tracks=metrics.completed_tracks,
        consistency_improvement=metrics.consistency_improvement,
        output_increase=metrics.output_increase,
        baseline_tracks_30d=metrics.baseline_tracks_30d,
    )


def _track_once(
    db: Session,
    *,
    user_id: int,
    bucket_key: str,
    event_name: str,
    props: dict,
) -> None:
    created = track_event_deduped(
        db,
        user_id=user_id,
        bucket_key=bucket_key,
        event_name=event_name,
        props=props,
    )
    if created:
        db.commit()


def _today_key() -> str:
    return utcnow().date().isoformat()
