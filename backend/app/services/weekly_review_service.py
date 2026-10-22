import json
import logging
from collections import Counter
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ProductionSession, UserGoal, WeeklyReviewSnapshot
from app.contracts.outcomes import WeeklyReviewPublic
from app.services.ollama_client import generate_weekly_coach_note
from app.services.streak_calendar import StreakCalendar, load_calendar
from app.services.weekly_goal_service import counted_studio_sessions_in_week

logger = logging.getLogger(__name__)

SUGGESTIONS = [
    "Schedule your next two sessions now at your strongest time window.",
    "Define one weekly outcome and attach each session to that outcome.",
    "End every session with a 2-line debrief so restart friction stays low.",
]


@dataclass(frozen=True)
class WeeklySummary:
    total_sessions: int
    total_seconds: int
    top_day: int | None
    top_hour: int | None


def _personal_week(db: Session, user_id: int) -> tuple[StreakCalendar, str, str]:
    calendar = load_calendar(db, user_id)
    week_start = date.fromisoformat(calendar.week_start_key)
    week_end = week_start + timedelta(days=6)
    return calendar, week_start.isoformat(), week_end.isoformat()


def _default_coach_note() -> str:
    return (
        "Strong producers win by consistency. Protect your best time slot, reduce restart friction, "
        "and keep sessions outcome-focused rather than time-focused."
    )


def _weekly_coach_prompt(
    *,
    total_sessions: int,
    total_seconds: int,
    target_sessions: int,
    top_day: int | None,
    top_hour: int | None,
    insights: list[str],
    blockers: list[str],
) -> str:
    return "\n".join(
        [
            "You are a concise production coach for a music creator app.",
            "Write exactly 2 short sentences (max 45 words total).",
            "Tone: motivating, practical, no hype, no emojis.",
            "Do not use bullet points or labels.",
            f"Weekly sessions: {total_sessions}",
            f"Weekly seconds: {total_seconds}",
            f"Weekly target sessions: {target_sessions}",
            f"Best weekday index (Mon=0): {top_day if top_day is not None else 'unknown'}",
            f"Best hour (24h): {top_hour if top_hour is not None else 'unknown'}",
            f"Insights: {' | '.join(insights) if insights else 'none'}",
            f"Blockers: {' | '.join(blockers) if blockers else 'none'}",
        ]
    )


def generate_weekly_review(db: Session, user_id: int) -> WeeklyReviewPublic:
    calendar, week_start, week_end = _personal_week(db, user_id)
    sessions = counted_studio_sessions_in_week(db, user_id, week_start)
    summary = _summarize_sessions(sessions, calendar)
    target = _weekly_target(db, user_id, week_start)
    insights = _build_insights(summary)
    blockers = _build_blockers(summary.total_sessions, target)
    ai_feedback = _generate_coach_feedback(summary, target, insights, blockers)
    row = _save_snapshot(
        db,
        user_id=user_id,
        week_start=week_start,
        week_end=week_end,
        summary=summary,
        insights=insights,
        blockers=blockers,
        ai_feedback=ai_feedback,
    )
    return _to_public(row)


def _summarize_sessions(sessions: list[ProductionSession], calendar: StreakCalendar) -> WeeklySummary:
    by_weekday: Counter[int] = Counter()
    by_hour: Counter[int] = Counter()
    for row in sessions:
        local = calendar.local_time_of(row.started_at)
        duration = int(row.duration_seconds or 0)
        by_weekday[local.weekday()] += duration
        by_hour[local.hour] += duration
    return WeeklySummary(
        total_sessions=len(sessions),
        total_seconds=sum(int(row.duration_seconds or 0) for row in sessions),
        top_day=by_weekday.most_common(1)[0][0] if by_weekday else None,
        top_hour=by_hour.most_common(1)[0][0] if by_hour else None,
    )


def _build_insights(summary: WeeklySummary) -> list[str]:
    insights: list[str] = []
    if summary.top_day is not None:
        insights.append(f"Your strongest output day was weekday #{summary.top_day + 1}.")
    if summary.top_hour is not None:
        insights.append(f"You performed best around {summary.top_hour:02d}:00.")
    if summary.total_sessions >= 4:
        insights.append("Your consistency is compounding; keep session cadence steady.")
    elif summary.total_sessions > 0:
        insights.append("Momentum exists; consistency is the next lever.")
    else:
        insights.append("No completed sessions this week yet.")
    return insights


def _weekly_target(db: Session, user_id: int, week_start: str) -> int:
    target = db.scalar(
        select(UserGoal.target_value).where(
            UserGoal.user_id == user_id,
            UserGoal.goal_type == "weekly_sessions",
            UserGoal.week_start == week_start,
        )
    )
    return int(target or 0)


def _build_blockers(total_sessions: int, target: int) -> list[str]:
    blockers: list[str] = []
    if target > total_sessions:
        blockers.append(f"You skipped {target - total_sessions} planned session(s).")
    if total_sessions == 0:
        blockers.append("No execution blocks were completed this week.")
    return blockers


def _generate_coach_feedback(
    summary: WeeklySummary,
    target: int,
    insights: list[str],
    blockers: list[str],
) -> str:
    prompt = _weekly_coach_prompt(
        total_sessions=summary.total_sessions,
        total_seconds=summary.total_seconds,
        target_sessions=target,
        top_day=summary.top_day,
        top_hour=summary.top_hour,
        insights=insights,
        blockers=blockers,
    )
    try:
        return generate_weekly_coach_note(prompt) or _default_coach_note()
    except Exception:
        logger.exception(
            "weekly_review_ai_provider_error",
            extra={"provider": "ollama", "context": "weekly_review_generate"},
        )
        return _default_coach_note()


def _save_snapshot(
    db: Session,
    *,
    user_id: int,
    week_start: str,
    week_end: str,
    summary: WeeklySummary,
    insights: list[str],
    blockers: list[str],
    ai_feedback: str,
) -> WeeklyReviewSnapshot:
    row = db.scalar(
        select(WeeklyReviewSnapshot).where(
            WeeklyReviewSnapshot.user_id == user_id,
            WeeklyReviewSnapshot.week_start == week_start,
        )
    )
    if row is None:
        row = WeeklyReviewSnapshot(user_id=user_id, week_start=week_start, week_end=week_end)
        db.add(row)
    row.total_sessions = summary.total_sessions
    row.total_seconds = summary.total_seconds
    row.insights_json = json.dumps(insights)
    row.blockers_json = json.dumps(blockers)
    row.suggestions_json = json.dumps(SUGGESTIONS)
    row.ai_feedback = ai_feedback
    row.week_end = week_end
    db.commit()
    return row


def _to_public(row: WeeklyReviewSnapshot) -> WeeklyReviewPublic:
    return WeeklyReviewPublic(
        week_start=row.week_start,
        week_end=row.week_end,
        total_sessions=row.total_sessions,
        total_seconds=row.total_seconds,
        insights=json.loads(row.insights_json or "[]"),
        blockers=json.loads(row.blockers_json or "[]"),
        suggestions=json.loads(row.suggestions_json or "[]"),
        ai_feedback=row.ai_feedback or "",
        share_image_url=row.share_image_url,
    )


def get_current_weekly_review(db: Session, user_id: int) -> WeeklyReviewPublic | None:
    _, week_start, _ = _personal_week(db, user_id)
    row = db.scalar(
        select(WeeklyReviewSnapshot).where(
            WeeklyReviewSnapshot.user_id == user_id,
            WeeklyReviewSnapshot.week_start == week_start,
        )
    )
    if row is None:
        return None
    return _to_public(row)
