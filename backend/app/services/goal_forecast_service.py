from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ProductionSession, UserGoal, utcnow
from app.schemas import GoalForecastPublic
from app.timeutil import as_utc_aware


def _monday_key(d):
    return (d - timedelta(days=d.weekday())).isoformat()


def build_goal_forecast(db: Session, user_id: int) -> GoalForecastPublic:
    now = utcnow().date()
    week_start = _monday_key(now)
    goal = db.scalar(
        select(UserGoal).where(
            UserGoal.user_id == user_id,
            UserGoal.goal_type == "weekly_sessions",
            UserGoal.week_start == week_start,
        )
    )
    target = int(goal.target_value) if goal else 4
    sessions = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()
    completed = len([s for s in sessions if _monday_key(as_utc_aware(s.started_at).date()) == week_start])
    remaining = max(0, target - completed)
    days_left = max(0, 6 - now.weekday())
    required = round(remaining / max(days_left, 1), 2) if remaining > 0 else 0.0
    if remaining <= 0:
        risk = "on_track"
        msg = "You are on track and already hit your weekly goal."
    elif required <= 1.0:
        risk = "at_risk"
        msg = f"You'll miss your goal unless you do {remaining} more session(s)."
    else:
        risk = "off_track"
        msg = f"High risk: complete {remaining} session(s) in {days_left} day(s) to catch up."
    return GoalForecastPublic(
        week_start=week_start,
        target_sessions=target,
        completed_sessions=completed,
        remaining_sessions=remaining,
        days_left=days_left,
        required_sessions_per_day=required,
        risk_level=risk,
        warning_message=msg,
    )
