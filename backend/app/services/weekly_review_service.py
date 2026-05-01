import json
import logging
from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ProductionSession, UserGoal, WeeklyReviewSnapshot, utcnow
from app.schemas import WeeklyReviewPublic
from app.services.ollama_client import generate_weekly_coach_note
from app.timeutil import as_utc_aware

logger = logging.getLogger(__name__)


def _week_range():
    today = utcnow().date()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    return week_start.isoformat(), week_end.isoformat()


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
    week_start, week_end = _week_range()
    week_start_dt = datetime.fromisoformat(week_start).replace(tzinfo=timezone.utc)
    week_end_dt = datetime.fromisoformat(week_end).replace(tzinfo=timezone.utc) + timedelta(days=1)

    totals = db.execute(
        select(
            func.count(ProductionSession.id),
            func.coalesce(func.sum(ProductionSession.duration_seconds), 0),
        ).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.started_at >= week_start_dt,
            ProductionSession.started_at < week_end_dt,
        )
    ).one()
    total_sessions = int(totals[0] or 0)
    total_seconds = int(totals[1] or 0)
    week_sessions = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.started_at >= week_start_dt,
            ProductionSession.started_at < week_end_dt,
        )
    ).all()
    by_weekday: Counter[int] = Counter()
    by_hour: Counter[int] = Counter()
    for row in week_sessions:
        dt = as_utc_aware(row.started_at)
        by_weekday[dt.weekday()] += int(row.duration_seconds or 0)
        by_hour[dt.hour] += int(row.duration_seconds or 0)
    top_day = by_weekday.most_common(1)[0][0] if by_weekday else None
    top_hour = by_hour.most_common(1)[0][0] if by_hour else None

    insights: list[str] = []
    if top_day is not None:
        insights.append(f"Your strongest output day was weekday #{top_day + 1}.")
    if top_hour is not None:
        insights.append(f"You performed best around {top_hour:02d}:00.")
    if total_sessions >= 4:
        insights.append("Your consistency is compounding; keep session cadence steady.")
    elif total_sessions > 0:
        insights.append("Momentum exists; consistency is the next lever.")
    else:
        insights.append("No completed sessions this week yet.")

    goal = db.scalar(
        select(UserGoal).where(
            UserGoal.user_id == user_id,
            UserGoal.goal_type == "weekly_sessions",
            UserGoal.week_start == week_start,
        )
    )
    blockers: list[str] = []
    target = int(goal.target_value) if goal else 0
    if target > total_sessions:
        blockers.append(f"You skipped {target - total_sessions} planned session(s).")
    if total_sessions == 0:
        blockers.append("No execution blocks were completed this week.")

    suggestions = [
        "Schedule your next two sessions now at your strongest time window.",
        "Define one weekly outcome and attach each session to that outcome.",
        "End every session with a 2-line debrief so restart friction stays low.",
    ]
    ai_feedback = _default_coach_note()
    prompt = _weekly_coach_prompt(
        total_sessions=total_sessions,
        total_seconds=total_seconds,
        target_sessions=target,
        top_day=top_day,
        top_hour=top_hour,
        insights=insights,
        blockers=blockers,
    )
    try:
        generated = generate_weekly_coach_note(prompt)
        if generated:
            ai_feedback = generated
    except Exception:
        logger.exception(
            "weekly_review_ai_provider_error",
            extra={"provider": "ollama", "context": "weekly_review_generate"},
        )
    row = db.scalar(
        select(WeeklyReviewSnapshot).where(
            WeeklyReviewSnapshot.user_id == user_id,
            WeeklyReviewSnapshot.week_start == week_start,
        )
    )
    if row is None:
        row = WeeklyReviewSnapshot(user_id=user_id, week_start=week_start, week_end=week_end)
        db.add(row)
    row.total_sessions = total_sessions
    row.total_seconds = total_seconds
    row.insights_json = json.dumps(insights)
    row.blockers_json = json.dumps(blockers)
    row.suggestions_json = json.dumps(suggestions)
    row.ai_feedback = ai_feedback
    row.week_end = week_end
    db.commit()
    return WeeklyReviewPublic(
        week_start=week_start,
        week_end=week_end,
        total_sessions=total_sessions,
        total_seconds=total_seconds,
        insights=insights,
        blockers=blockers,
        suggestions=suggestions,
        ai_feedback=ai_feedback,
        share_image_url=row.share_image_url,
    )


def get_current_weekly_review(db: Session, user_id: int) -> WeeklyReviewPublic | None:
    week_start, _ = _week_range()
    row = db.scalar(
        select(WeeklyReviewSnapshot).where(
            WeeklyReviewSnapshot.user_id == user_id,
            WeeklyReviewSnapshot.week_start == week_start,
        )
    )
    if row is None:
        return None
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
