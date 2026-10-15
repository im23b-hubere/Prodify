"""
Everything the candidate generators may look at for one producer, loaded in one place so the
generators themselves stay pure. Friends' data is reduced to name, duration and time.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    LeaderboardSnapshot,
    NotificationDelivery,
    ProductionSession,
    SocialChallenge,
    SocialChallengeMember,
    User,
    UserEngagementProfile,
    UserProgression,
)
from app.services.engagement.learning_store import learned_signals
from app.services.engagement.preferences import NotificationCategory
from app.services.engagement.profile import BehaviorProfile
from app.services.engagement.profile_store import load_fresh_profile
from app.services.friend_graph import friend_user_ids
from app.services.friend_metrics_service import session_counts_since
from app.services.social_challenge_service import (
    challenge_duration_days,
    challenge_window_start,
    load_challenge_meta,
)
from app.services.streak_calendar import StreakCalendar, load_calendar
from app.services.streak_state import streak_snapshot
from app.services.user_block_service import hidden_user_ids
from app.timeutil import as_utc_aware

FRIEND_SESSION_LOOKBACK = timedelta(minutes=60)
RECENT_DELIVERY_LOOKBACK = timedelta(days=3)
_FIRST_LEVEL_XP_GAP = 50


@dataclass(frozen=True)
class FriendSession:
    friend_id: int
    friend_name: str
    ended_at: datetime
    duration_minutes: int


@dataclass(frozen=True)
class ChallengeStanding:
    challenge_id: int
    title: str
    sessions_remaining: int
    ends_at: datetime
    last_progress_at: datetime


@dataclass(frozen=True)
class LeaderboardStanding:
    """Place among the producer and their friends by sessions this local week; 1 is first."""

    rank: int
    previous_rank: int | None
    session_count: int
    friend_ahead_name: str | None


@dataclass(frozen=True)
class EngagementContext:
    user_id: int
    zone: ZoneInfo
    profile: BehaviorProfile
    streak_days: int
    streak_at_risk: bool
    current_level: int
    xp_to_next_level: int
    challenges: tuple[ChallengeStanding, ...]
    friend_sessions: tuple[FriendSession, ...]
    leaderboard: LeaderboardStanding | None
    recent_deliveries: tuple[NotificationDelivery, ...]
    # Learned from settled pushes; a missing category counts as neutral.
    motivation: Mapping[NotificationCategory, float] = field(default_factory=dict)
    fatigue_score: float = 0
    ignored_streak: int = 0
    preferred_notification_hour: int | None = None


def load_engagement_context(db: Session, user_id: int, now: datetime) -> EngagementContext:
    calendar = load_calendar(db, user_id)
    friend_ids = _visible_friend_ids(db, user_id)
    streak_days, streak_at_risk = streak_snapshot(db, user_id, today=calendar.local_time_of(now).date())
    progression = db.get(UserProgression, user_id)
    profile = load_fresh_profile(db, user_id, now)
    learned = learned_signals(db.get(UserEngagementProfile, user_id))
    return EngagementContext(
        user_id=user_id,
        zone=calendar.zone,
        profile=profile,
        streak_days=streak_days,
        streak_at_risk=streak_at_risk,
        current_level=progression.current_level if progression else 1,
        xp_to_next_level=progression.xp_to_next_level if progression else _FIRST_LEVEL_XP_GAP,
        challenges=_active_challenges(db, user_id),
        friend_sessions=_recent_friend_sessions(db, friend_ids, now),
        leaderboard=_leaderboard_standing(db, user_id, friend_ids, calendar, now),
        recent_deliveries=_recent_deliveries(db, user_id, now),
        motivation=learned.motivation,
        fatigue_score=learned.fatigue_score,
        ignored_streak=learned.ignored_streak,
        preferred_notification_hour=learned.preferred_notification_hour,
    )


def record_leaderboard_snapshot(
    db: Session, user_id: int, standing: LeaderboardStanding, calendar: StreakCalendar, now: datetime
) -> None:
    """Remember today's place so the next run can spot an overtake; the caller commits."""
    week_start = calendar.week_start_key_of(now)
    row = db.get(LeaderboardSnapshot, (user_id, week_start))
    if row is None:
        row = LeaderboardSnapshot(user_id=user_id, week_start=week_start)
        db.add(row)
    row.rank = standing.rank
    row.session_count = standing.session_count
    row.captured_at = now
    db.flush()


def _visible_friend_ids(db: Session, user_id: int) -> list[int]:
    hidden = hidden_user_ids(db, user_id)
    return [friend_id for friend_id in friend_user_ids(db, user_id) if friend_id not in hidden]


def _active_challenges(db: Session, user_id: int) -> tuple[ChallengeStanding, ...]:
    rows = db.execute(
        select(SocialChallenge, SocialChallengeMember)
        .join(SocialChallengeMember, SocialChallengeMember.challenge_id == SocialChallenge.id)
        .where(SocialChallengeMember.user_id == user_id, SocialChallenge.status == "active")
    ).all()
    return tuple(_challenge_standing(challenge, member) for challenge, member in rows)


def _challenge_standing(challenge: SocialChallenge, member: SocialChallengeMember) -> ChallengeStanding:
    started_at = challenge_window_start(challenge)
    duration = timedelta(days=challenge_duration_days(load_challenge_meta(challenge)))
    return ChallengeStanding(
        challenge_id=challenge.id,
        title=challenge.title,
        sessions_remaining=max(0, challenge.target_sessions - member.progress_sessions),
        ends_at=started_at + duration,
        last_progress_at=as_utc_aware(member.updated_at),
    )


def _recent_friend_sessions(db: Session, friend_ids: list[int], now: datetime) -> tuple[FriendSession, ...]:
    if not friend_ids:
        return ()
    rows = db.execute(
        select(ProductionSession.user_id, User.username, ProductionSession.stopped_at, ProductionSession.duration_seconds)
        .join(User, User.id == ProductionSession.user_id)
        .where(
            ProductionSession.user_id.in_(friend_ids),
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.stopped_at >= now - FRIEND_SESSION_LOOKBACK,
        )
        .order_by(ProductionSession.stopped_at.desc())
    ).all()
    return tuple(
        FriendSession(
            friend_id=friend_id,
            friend_name=username,
            ended_at=as_utc_aware(stopped_at),
            duration_minutes=int(duration_seconds) // 60,
        )
        for friend_id, username, stopped_at, duration_seconds in rows
    )


def _leaderboard_standing(
    db: Session, user_id: int, friend_ids: list[int], calendar: StreakCalendar, now: datetime
) -> LeaderboardStanding | None:
    if not friend_ids:
        return None
    week_start = calendar.week_start_key_of(now)
    counts = session_counts_since(db, [user_id, *friend_ids], _local_midnight_utc(week_start, calendar.zone))
    mine = counts.get(user_id, 0)
    ahead = [friend_id for friend_id in friend_ids if counts.get(friend_id, 0) > mine]
    snapshot = db.get(LeaderboardSnapshot, (user_id, week_start))
    return LeaderboardStanding(
        rank=len(ahead) + 1,
        previous_rank=snapshot.rank if snapshot else None,
        session_count=mine,
        friend_ahead_name=_closest_ahead_name(db, ahead, counts),
    )


def _closest_ahead_name(db: Session, ahead: list[int], counts: dict[int, int]) -> str | None:
    if not ahead:
        return None
    closest = min(ahead, key=lambda friend_id: counts.get(friend_id, 0))
    return db.scalar(select(User.username).where(User.id == closest))


def _local_midnight_utc(day_key: str, zone: ZoneInfo) -> datetime:
    return datetime.combine(date.fromisoformat(day_key), time.min, tzinfo=zone).astimezone(timezone.utc)


def _recent_deliveries(db: Session, user_id: int, now: datetime) -> tuple[NotificationDelivery, ...]:
    return tuple(
        db.scalars(
            select(NotificationDelivery).where(
                NotificationDelivery.user_id == user_id,
                NotificationDelivery.sent_at >= now - RECENT_DELIVERY_LOOKBACK,
            )
        ).all()
    )
