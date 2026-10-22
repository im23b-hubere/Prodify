from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ProductionSession, UserGoal
from app.schemas import GoalCurrentPublic
from app.services.kpi_tracker import track_event
from app.services.skill_progress_service import is_counted_studio_session
from app.services.streak_calendar import load_calendar


def set_weekly_goal(
    db: Session,
    user_id: int,
    goal_type: str,
    target_value: int,
) -> GoalCurrentPublic:
    week_start = load_calendar(db, user_id).week_start_key
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
    return _goal_snapshot(db, user_id, goal, configured=True)


def current_weekly_goal(db: Session, user_id: int) -> GoalCurrentPublic:
    week_start = load_calendar(db, user_id).week_start_key
    goal = _find_goal(db, user_id, "weekly_sessions", week_start)
    configured = goal is not None
    if goal is None:
        goal = UserGoal(
            user_id=user_id,
            goal_type="weekly_sessions",
            target_value=5,
            week_start=week_start,
        )
    return _goal_snapshot(db, user_id, goal, configured=configured)


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


def counted_studio_sessions_in_week(
    db: Session,
    user_id: int,
    week_start: str,
) -> list[ProductionSession]:
    """Finished sessions of at least five minutes whose personal week is this Monday."""
    calendar = load_calendar(db, user_id)
    sessions = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()
    return [
        session
        for session in sessions
        if calendar.week_start_key_of(session.started_at) == week_start
        and is_counted_studio_session(session.duration_seconds)
    ]


def _goal_snapshot(db: Session, user_id: int, goal: UserGoal, *, configured: bool) -> GoalCurrentPublic:
    current_sessions = len(counted_studio_sessions_in_week(db, user_id, goal.week_start))
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
        configured=configured,
    )
