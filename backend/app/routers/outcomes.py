from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.dependencies_subscription import require_premium_or_trial
from app.models import ProductionSession, User
from app.schemas import CoachDebriefPublic, GoalForecastPublic, WeeklyReviewPublic
from app.services.ai_coach_service import build_session_coach_debrief
from app.services.goal_forecast_service import build_goal_forecast
from app.services.kpi_tracker import track_event
from app.services.weekly_review_service import generate_weekly_review, get_current_weekly_review

router = APIRouter(prefix="/outcomes", tags=["outcomes"])


@router.get("/weekly-review/current", response_model=WeeklyReviewPublic | None)
def weekly_review_current(
    _: Annotated[object, Depends(require_premium_or_trial)],
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    review = get_current_weekly_review(db, current.id)
    if review is not None:
        track_event(db, "weekly_review_viewed", current.id, {"week_start": review.week_start})
        db.commit()
    return review


@router.post("/weekly-review/generate", response_model=WeeklyReviewPublic)
def weekly_review_generate(
    _: Annotated[object, Depends(require_premium_or_trial)],
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    review = generate_weekly_review(db, current.id)
    track_event(db, "weekly_review_generated", current.id, {"week_start": review.week_start})
    db.commit()
    return review


@router.get("/goal-forecast/current", response_model=GoalForecastPublic)
def goal_forecast_current(
    _: Annotated[object, Depends(require_premium_or_trial)],
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    out = build_goal_forecast(db, current.id)
    track_event(db, "goal_forecast_seen", current.id, {"risk_level": out.risk_level})
    db.commit()
    return out


@router.get("/coach/session/{session_id}", response_model=CoachDebriefPublic)
def coach_for_session(
    _: Annotated[object, Depends(require_premium_or_trial)],
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
    track_event(db, "coach_debrief_viewed", current.id, {"session_id": session_id})
    db.commit()
    return out
