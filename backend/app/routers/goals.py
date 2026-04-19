from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ProductionSession, User, UserGoal, utcnow
from app.schemas import GoalCurrentPublic, GoalSetBody
from app.timeutil import as_utc_aware
from app.services.kpi_tracker import track_event

router = APIRouter(prefix="/goals", tags=["goals"])


def _monday(d: date) -> str:
    return (d - timedelta(days=d.weekday())).isoformat()


@router.post("/set", response_model=GoalCurrentPublic)
def set_weekly_goal(
    body: GoalSetBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    week_key = _monday(utcnow().date())
    row = db.scalar(
        select(UserGoal).where(
            UserGoal.user_id == current.id,
            UserGoal.goal_type == body.goal_type,
            UserGoal.week_start == week_key,
        )
    )
    if row is None:
        row = UserGoal(user_id=current.id, goal_type=body.goal_type, target_value=body.target_value, week_start=week_key)
        db.add(row)
    else:
        row.target_value = body.target_value
    db.commit()
    db.refresh(row)
    track_event(db, "weekly_goal_set", current.id, {"goal_type": row.goal_type, "target_value": row.target_value})
    db.commit()

    return _goal_snapshot(db, current.id, row)


def _goal_snapshot(db: Session, user_id: int, goal: UserGoal) -> GoalCurrentPublic:
    rows = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()
    same_week = [r for r in rows if _monday(as_utc_aware(r.started_at).date()) == goal.week_start]
    cur = len(same_week)
    pct = min(100.0, (cur / goal.target_value) * 100) if goal.target_value > 0 else 0.0
    return GoalCurrentPublic(
        goal_type=goal.goal_type,
        target_value=goal.target_value,
        week_start=goal.week_start,
        current_sessions=cur,
        progress_percent=round(pct, 1),
    )


@router.get("/current", response_model=GoalCurrentPublic)
def current_goal(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    week_key = _monday(utcnow().date())
    row = db.scalar(
        select(UserGoal).where(
            UserGoal.user_id == current.id,
            UserGoal.goal_type == "weekly_sessions",
            UserGoal.week_start == week_key,
        )
    )
    if row is None:
        row = UserGoal(user_id=current.id, goal_type="weekly_sessions", target_value=5, week_start=week_key)
        db.add(row)
        db.commit()
        db.refresh(row)
    return _goal_snapshot(db, current.id, row)
