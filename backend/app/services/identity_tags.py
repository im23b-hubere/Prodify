from __future__ import annotations

from datetime import datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CheckinLog, ProductionSession, SocialChallengeMember, SocialComment, StreakRescue, utcnow


def social_identity_tags(db: Session, user_id: int, *, week_start: str) -> list[str]:
    """Identity tag model used by social surfaces."""
    tags: list[str] = []
    sessions_this_week = int(
        db.scalar(
            select(func.count())
            .select_from(ProductionSession)
            .where(
                ProductionSession.user_id == user_id,
                ProductionSession.deleted_at.is_(None),
                ProductionSession.duration_seconds.is_not(None),
                ProductionSession.started_at >= datetime.fromisoformat(week_start).replace(tzinfo=timezone.utc),
                ProductionSession.started_at < datetime.fromisoformat(week_start).replace(tzinfo=timezone.utc)
                + timedelta(days=7),
            )
        )
        or 0
    )
    if sessions_this_week >= 4:
        tags.append("consistent_creator")

    checkins_week_count = int(
        db.scalar(
            select(func.count())
            .select_from(CheckinLog)
            .where(CheckinLog.user_id == user_id, CheckinLog.day_key >= week_start)
        )
        or 0
    )
    if checkins_week_count >= 3 and "consistent_creator" not in tags:
        tags.append("consistent_creator")

    comment_count = int(
        db.scalar(select(func.count()).select_from(SocialComment).where(SocialComment.author_id == user_id)) or 0
    )
    rescue_count = int(
        db.scalar(select(func.count()).select_from(StreakRescue).where(StreakRescue.rescuer_user_id == user_id)) or 0
    )
    supportive_score = comment_count + rescue_count * 2
    if supportive_score >= 2:
        tags.append("collaborative")

    challenge_count = int(
        db.scalar(select(func.count()).select_from(SocialChallengeMember).where(SocialChallengeMember.user_id == user_id))
        or 0
    )
    if challenge_count > 0:
        tags.append("competitive")

    momentum_like = sessions_this_week + checkins_week_count + min(3, challenge_count)
    if momentum_like >= 6:
        tags.append("locked_in")

    now = utcnow()
    recent_7_count = int(
        db.scalar(
            select(func.count())
            .select_from(ProductionSession)
            .where(
                ProductionSession.user_id == user_id,
                ProductionSession.deleted_at.is_(None),
                ProductionSession.duration_seconds.is_not(None),
                ProductionSession.started_at >= now - timedelta(days=7),
            )
        )
        or 0
    )
    prior_30_to_7_count = int(
        db.scalar(
            select(func.count())
            .select_from(ProductionSession)
            .where(
                ProductionSession.user_id == user_id,
                ProductionSession.deleted_at.is_(None),
                ProductionSession.duration_seconds.is_not(None),
                ProductionSession.started_at < now - timedelta(days=7),
                ProductionSession.started_at >= now - timedelta(days=30),
            )
        )
        or 0
    )
    if recent_7_count >= 2 and prior_30_to_7_count == 0:
        tags.append("building_momentum")
    return tags[:2] if tags else ["creator"]


def profile_identity_tags(db: Session, user_id: int) -> list[str]:
    """Identity tag model used by user profile surfaces."""
    wk = (utcnow().date() - timedelta(days=utcnow().date().weekday())).isoformat()
    sessions_week = len(
        db.scalars(
            select(ProductionSession).where(
                ProductionSession.user_id == user_id,
                ProductionSession.deleted_at.is_(None),
                ProductionSession.duration_seconds.is_not(None),
                ProductionSession.started_at >= datetime.combine(
                    datetime.fromisoformat(wk).date(), time.min, tzinfo=timezone.utc
                ),
            )
        ).all()
    )
    tags: list[str] = []
    if sessions_week >= 4:
        tags.append("consistent_creator")
    challenge_rows = db.scalars(select(SocialChallengeMember).where(SocialChallengeMember.user_id == user_id)).all()
    if challenge_rows:
        tags.append("competitive")
    if sessions_week >= 6:
        tags.append("locked_in")
    return tags[:2] if tags else ["creator"]
