from datetime import date

from sqlalchemy.orm import Session

from app.contracts.outcomes import GoalForecastPublic
from app.services.streak_calendar import load_calendar
from app.services.weekly_goal_service import current_weekly_goal


def build_goal_forecast(db: Session, user_id: int) -> GoalForecastPublic:
    goal = current_weekly_goal(db, user_id)
    today = load_calendar(db, user_id).today
    return _forecast_from_progress(
        week_start=goal.week_start,
        target_sessions=goal.target_value,
        completed_sessions=goal.current_sessions,
        today=today,
    )


def _forecast_from_progress(
    *,
    week_start: str,
    target_sessions: int,
    completed_sessions: int,
    today: date,
) -> GoalForecastPublic:
    remaining = max(0, target_sessions - completed_sessions)
    days_left = max(0, 6 - today.weekday())
    required = round(remaining / max(days_left, 1), 2) if remaining > 0 else 0.0
    if remaining <= 0:
        risk = "on_track"
        message = "You are on track and already hit your weekly goal."
    elif required <= 1.0:
        risk = "at_risk"
        message = f"You'll miss your goal unless you do {remaining} more session(s)."
    else:
        risk = "off_track"
        message = f"High risk: complete {remaining} session(s) in {days_left} day(s) to catch up."
    return GoalForecastPublic(
        week_start=week_start,
        target_sessions=target_sessions,
        completed_sessions=completed_sessions,
        remaining_sessions=remaining,
        days_left=days_left,
        required_sessions_per_day=required,
        risk_level=risk,
        warning_message=message,
    )
