from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.dependencies_subscription import require_premium_or_trial
from app.models import ProductionSession, User, utcnow
from app.rate_limit import limiter
from app.schemas import (
    CoachDebriefPublic,
    EntitlementPublic,
    GoalForecastPublic,
    OutputMetricsPublic,
    StatsCoachChatBody,
    StatsCoachChatPublic,
    StatsCoachPublic,
    WeeklyReviewPublic,
)
from app.services.ai_coach_service import build_session_coach_debrief
from app.services.goal_forecast_service import build_goal_forecast
from app.services.kpi_tracker import track_event, track_event_deduped
from app.services.outcome_metrics_service import OutcomeMetricsService
from app.services.stats_coach_service import build_stats_chat_reply, build_stats_coach
from app.services.weekly_review_service import generate_weekly_review, get_current_weekly_review

router = APIRouter(prefix="/outcomes", tags=["outcomes"])


@router.get("/weekly-review/current", response_model=WeeklyReviewPublic | None)
def weekly_review_current(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    review = get_current_weekly_review(db, current.id)
    if review is not None:
        if track_event_deduped(
            db,
            user_id=current.id,
            bucket_key=f"weekly_review_viewed:{review.week_start}",
            event_name="weekly_review_viewed",
            props={"week_start": review.week_start},
        ):
            db.commit()
    return review


@router.post("/weekly-review/generate", response_model=WeeklyReviewPublic)
@limiter.limit("10/minute")
def weekly_review_generate(
    request: Request,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    review = generate_weekly_review(db, current.id)
    track_event(db, "weekly_review_generated", current.id, {"week_start": review.week_start})
    db.commit()
    return review


@router.get("/goal-forecast/current", response_model=GoalForecastPublic)
def goal_forecast_current(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    _entitlement: Annotated[EntitlementPublic, Depends(require_premium_or_trial)],
):
    out = build_goal_forecast(db, current.id)
    day = utcnow().date().isoformat()
    if track_event_deduped(
        db,
        user_id=current.id,
        bucket_key=f"goal_forecast_seen:{day}",
        event_name="goal_forecast_seen",
        props={"risk_level": out.risk_level},
    ):
        db.commit()
    return out


@router.get("/coach/session/{session_id}", response_model=CoachDebriefPublic)
def coach_for_session(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.scalar(select(ProductionSession).where(ProductionSession.id == session_id))
    if row is None or row.user_id != current.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if row.duration_seconds is None:
        raise HTTPException(status_code=400, detail="Session must be completed")
    out = build_session_coach_debrief(row)
    day = utcnow().date().isoformat()
    if track_event_deduped(
        db,
        user_id=current.id,
        bucket_key=f"coach_debrief_viewed:{session_id}:{day}",
        event_name="coach_debrief_viewed",
        props={"session_id": session_id},
    ):
        db.commit()
    return out


@router.get("/output-metrics/current", response_model=OutputMetricsPublic)
def output_metrics_current(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    out = OutcomeMetricsService.calculate(current.id, db)
    day = utcnow().date().isoformat()
    if track_event_deduped(
        db,
        user_id=current.id,
        bucket_key=f"outcome_metrics_viewed:{day}",
        event_name="outcome_metrics_viewed",
        props={"trend": out.productivity_trend, "tracks_finished_30d": out.tracks_finished_30d},
    ):
        db.commit()
    return OutputMetricsPublic(
        tracks_finished_30d=out.tracks_finished_30d,
        avg_completion_time_days=out.avg_completion_time_days,
        release_consistency=out.release_consistency,
        productivity_trend=out.productivity_trend,  # type: ignore[arg-type]
        vs_previous_month=out.vs_previous_month,
        days_using=out.days_using,
        completed_tracks=out.completed_tracks,
        consistency_improvement=out.consistency_improvement,
        output_increase=out.output_increase,
        baseline_tracks_30d=out.baseline_tracks_30d,
    )


@router.get("/stats-coach/current", response_model=StatsCoachPublic)
def stats_coach_current(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    out = build_stats_coach(db, current.id)
    day = utcnow().date().isoformat()
    if track_event_deduped(
        db,
        user_id=current.id,
        bucket_key=f"stats_coach_seen:{day}",
        event_name="stats_coach_seen",
        props={"eligible": out.eligible},
    ):
        db.commit()
    return out


@router.post("/stats-coach/chat", response_model=StatsCoachChatPublic)
@limiter.limit("20/minute")
def stats_coach_chat(
    request: Request,
    body: StatsCoachChatBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    out = build_stats_chat_reply(
        db,
        current.id,
        message=body.message,
        preset_key=body.preset_key,
        focus_area=body.focus_area,
        plan_horizon=body.plan_horizon,
        intensity=body.intensity,
        history=body.history,
    )
    track_event(
        db,
        "stats_coach_chat",
        current.id,
        {"eligible": out.eligible, "preset_key": body.preset_key or "", "reason": out.reason or ""},
    )
    db.commit()
    return out
