from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ProductionSession, UserGoal, utcnow
from app.schemas import GoalCurrentPublic
from app.services.kpi_tracker import track_event
from app.timeutil import as_utc_aware


def set_weekly_goal(
    db: Session,
    user_id: int,
    goal_type: str,
    target_value: int,
) -> GoalCurrentPublic:
    week_start = _week_start(utcnow().date())
    goal = _find_goal(db, user_id, goal_type, week_start)
    if goal is None:
        goal = UserGoal(
            user_id=user_id,
            goal_type=goal_type,
            target_value=target_value,
            week_start=week_start,
        )
        db.add(goal)
    else:
        goal.target_value = target_value
    track_event(
        db,
        "weekly_goal_set",
        user_id,
        {"goal_type": goal.goal_type, "target_value": goal.target_value},
    )
    db.commit()
    return _goal_snapshot(db, user_id, goal)


def current_weekly_goal(db: Session, user_id: int) -> GoalCurrentPublic:
    week_start = _week_start(utcnow().date())
    goal = _find_goal(db, user_id, "weekly_sessions", week_start)
    if goal is None:
        goal = UserGoal(
            user_id=user_id,
            goal_type="weekly_sessions",
            target_value=5,
            week_start=week_start,
        )
    return _goal_snapshot(db, user_id, goal)


def _find_goal(
    db: Session,
    user_id: int,
    goal_type: str,
    week_start: str,
) -> UserGoal | None:
    return db.scalar(
        select(UserGoal).where(
            UserGoal.user_id == user_id,
            UserGoal.goal_type == goal_type,
            UserGoal.week_start == week_start,
        )
    )


def _goal_snapshot(db: Session, user_id: int, goal: UserGoal) -> GoalCurrentPublic:
    sessions = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()
    current_sessions = sum(
        _week_start(as_utc_aware(session.started_at).date()) == goal.week_start
        for session in sessions
    )
    progress = (
        min(100.0, (current_sessions / goal.target_value) * 100)
        if goal.target_value > 0
        else 0.0
    )
    return GoalCurrentPublic(
        goal_type=goal.goal_type,
        target_value=goal.target_value,
        week_start=goal.week_start,
        current_sessions=current_sessions,
        progress_percent=round(progress, 1),
    )


def _week_start(value: date) -> str:
    return (value - timedelta(days=value.weekday())).isoformat()
