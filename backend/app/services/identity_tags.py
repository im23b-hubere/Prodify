from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CheckinLog, ProductionSession, SocialChallengeMember, SocialComment, StreakRescue, utcnow


@dataclass(frozen=True)
class SocialIdentitySignals:
    sessions_this_week: int
    checkins_this_week: int
    comments: int
    rescues: int
    challenges: int
    recent_sessions: int
    prior_sessions: int


def social_identity_tags(db: Session, user_id: int, *, week_start: str) -> list[str]:
    """Return the two strongest identity tags for social surfaces."""
    signals = _social_signals(db, user_id, week_start)
    candidates = [
        (signals.sessions_this_week >= 4 or signals.checkins_this_week >= 3, "consistent_creator"),
        (signals.comments + signals.rescues * 2 >= 2, "collaborative"),
        (signals.challenges > 0, "competitive"),
        (
            signals.sessions_this_week + signals.checkins_this_week + min(3, signals.challenges) >= 6,
            "locked_in",
        ),
        (signals.recent_sessions >= 2 and signals.prior_sessions == 0, "building_momentum"),
    ]
    return _top_tags(candidates)


def profile_identity_tags(db: Session, user_id: int) -> list[str]:
    """Return identity tags shown on user profiles."""
    week_start = utcnow() - timedelta(days=utcnow().date().weekday())
    sessions = _session_count(db, user_id, since=week_start.replace(hour=0, minute=0, second=0, microsecond=0))
    challenges = _count(
        db,
        select(func.count()).select_from(SocialChallengeMember).where(
            SocialChallengeMember.user_id == user_id
        ),
    )
    return _top_tags(
        [
            (sessions >= 4, "consistent_creator"),
            (challenges > 0, "competitive"),
            (sessions >= 6, "locked_in"),
        ]
    )


def _social_signals(db: Session, user_id: int, week_start: str) -> SocialIdentitySignals:
    week_start_at = datetime.fromisoformat(week_start).replace(tzinfo=timezone.utc)
    now = utcnow()
    return SocialIdentitySignals(
        sessions_this_week=_session_count(
            db,
            user_id,
            since=week_start_at,
            until=week_start_at + timedelta(days=7),
        ),
        checkins_this_week=_count(
            db,
            select(func.count()).select_from(CheckinLog).where(
                CheckinLog.user_id == user_id,
                CheckinLog.day_key >= week_start,
            ),
        ),
        comments=_count(
            db,
            select(func.count()).select_from(SocialComment).where(SocialComment.author_id == user_id),
        ),
        rescues=_count(
            db,
            select(func.count()).select_from(StreakRescue).where(StreakRescue.rescuer_user_id == user_id),
        ),
        challenges=_count(
            db,
            select(func.count()).select_from(SocialChallengeMember).where(
                SocialChallengeMember.user_id == user_id
            ),
        ),
        recent_sessions=_session_count(db, user_id, since=now - timedelta(days=7)),
        prior_sessions=_session_count(
            db,
            user_id,
            since=now - timedelta(days=30),
            until=now - timedelta(days=7),
        ),
    )


def _session_count(
    db: Session,
    user_id: int,
    *,
    since: datetime,
    until: datetime | None = None,
) -> int:
    query = select(func.count()).select_from(ProductionSession).where(
        ProductionSession.user_id == user_id,
        ProductionSession.deleted_at.is_(None),
        ProductionSession.duration_seconds.is_not(None),
        ProductionSession.started_at >= since,
    )
    if until is not None:
        query = query.where(ProductionSession.started_at < until)
    return _count(db, query)


def _top_tags(candidates: list[tuple[bool, str]]) -> list[str]:
    tags = [tag for matches, tag in candidates if matches]
    return tags[:2] if tags else ["creator"]


def _count(db: Session, query) -> int:
    return int(db.scalar(query) or 0)
