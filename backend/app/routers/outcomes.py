from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.dependencies_subscription import require_premium_or_trial
from app.models import User
from app.rate_limit import limiter
from app.contracts.billing import EntitlementPublic
from app.contracts.outcomes import (
    GoalForecastPublic,
    OutputMetricsPublic,
    WeeklyReviewPublic,
)
from app.services.outcome_application_service import (
    create_weekly_review,
    current_goal_forecast as build_current_goal_forecast,
    current_output_metrics as build_current_output_metrics,
    current_weekly_review as build_current_weekly_review,
)

router = APIRouter(prefix="/outcomes", tags=["outcomes"])


@router.get("/weekly-review/current", response_model=WeeklyReviewPublic | None)
def weekly_review_current(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    _entitlement: Annotated[EntitlementPublic, Depends(require_premium_or_trial)],
):
    return build_current_weekly_review(db, current.id)


@router.post("/weekly-review/generate", response_model=WeeklyReviewPublic)
@limiter.limit("10/minute")
def weekly_review_generate(
    request: Request,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    _entitlement: Annotated[EntitlementPublic, Depends(require_premium_or_trial)],
):
    return create_weekly_review(db, current.id)


@router.get("/goal-forecast/current", response_model=GoalForecastPublic)
def goal_forecast_current(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    _entitlement: Annotated[EntitlementPublic, Depends(require_premium_or_trial)],
):
    return build_current_goal_forecast(db, current.id)


@router.get("/output-metrics/current", response_model=OutputMetricsPublic)
def output_metrics_current(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return build_current_output_metrics(db, current.id)
