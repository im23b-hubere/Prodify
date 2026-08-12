from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User, utcnow
from app.schemas import FriendLeaderboardEntryPublic, FriendLeaderboardPublic
from app.services.friend_graph import friend_user_ids
from app.services.friend_metrics_service import session_counts_between, session_counts_since, streak_by_user
from app.services.streak_reconcile_service import compute_streak_counts_for_display
from app.services.streak_status_service import streak_status_for_days


@dataclass(frozen=True)
class LeaderboardPeriod:
    label: str
    days: int | None

    @classmethod
    def parse(cls, value: str) -> "LeaderboardPeriod":
        if value == "all":
            return cls(label="all", days=None)
        return cls(label="week", days=7)


@dataclass(frozen=True)
class RankedFriend:
    user_id: int
    username: str
    sessions: int
    streak_days: int
    is_premium: bool
    profile_picture_url: str | None
    status_key: str
    status_label: str
    status_emoji: str


def build_friend_leaderboard(
    db: Session,
    current_user_id: int,
    requested_period: str,
) -> FriendLeaderboardPublic:
    period = LeaderboardPeriod.parse(requested_period)
    user_ids = [current_user_id, *friend_user_ids(db, current_user_id)]
    current_counts, previous_counts = _session_counts(db, user_ids, period)
    ranked_friends = _rank_friends(db, user_ids, current_counts)
    current_user_rank = _rank_of(ranked_friends, current_user_id)
    entries = [
        _to_public_entry(friend, rank, current_user_rank, previous_counts, period)
        for rank, friend in enumerate(ranked_friends, start=1)
    ]
    return FriendLeaderboardPublic(period=period.label, entries=entries)


def _session_counts(
    db: Session,
    user_ids: list[int],
    period: LeaderboardPeriod,
) -> tuple[dict[int, int], dict[int, int]]:
    now = utcnow()
    if period.days is None:
        return session_counts_since(db, user_ids, now - timedelta(days=365 * 50)), {}
    current_start = now - timedelta(days=period.days)
    previous_start = current_start - timedelta(days=period.days)
    return (
        session_counts_since(db, user_ids, current_start),
        session_counts_between(db, user_ids, previous_start, current_start),
    )


def _rank_friends(
    db: Session,
    user_ids: list[int],
    session_counts: dict[int, int],
) -> list[RankedFriend]:
    users = {user.id: user for user in db.scalars(select(User).where(User.id.in_(user_ids))).all()}
    friends = [
        _friend_metrics(db, users[user_id], session_counts.get(user_id, 0))
        for user_id in user_ids
        if user_id in users
    ]
    return sorted(friends, key=lambda friend: (friend.sessions, friend.streak_days), reverse=True)


def _friend_metrics(db: Session, user: User, session_count: int) -> RankedFriend:
    streak_days, _ = compute_streak_counts_for_display(db, user.id)
    streak = streak_by_user(db, user.id)
    inactive_days = 0
    if streak and streak.last_session_date:
        inactive_days = max((utcnow().date() - streak.last_session_date.date()).days, 0)
    status_key, status_label, status_emoji = streak_status_for_days(streak_days, inactive_days)
    return RankedFriend(
        user_id=user.id,
        username=user.username,
        sessions=int(session_count),
        streak_days=streak_days,
        is_premium=bool(int(user.is_premium or 0)),
        profile_picture_url=user.profile_picture_url,
        status_key=status_key,
        status_label=status_label,
        status_emoji=status_emoji,
    )


def _rank_of(friends: list[RankedFriend], user_id: int) -> int | None:
    return next(
        (rank for rank, friend in enumerate(friends, start=1) if friend.user_id == user_id),
        None,
    )


def _to_public_entry(
    friend: RankedFriend,
    rank: int,
    current_user_rank: int | None,
    previous_counts: dict[int, int],
    period: LeaderboardPeriod,
) -> FriendLeaderboardEntryPublic:
    previous_sessions = previous_counts.get(friend.user_id, 0) if period.days is not None else friend.sessions
    delta = friend.sessions - int(previous_sessions)
    return FriendLeaderboardEntryPublic(
        rank=rank,
        user_id=friend.user_id,
        username=friend.username,
        current_streak_days=friend.streak_days,
        sessions_in_period=friend.sessions,
        sessions_delta_vs_prior=delta,
        trend="up" if delta > 0 else "down" if delta < 0 else "flat",
        is_chasing_you=bool(current_user_rank is not None and rank == current_user_rank - 1),
        is_threatening_you=bool(current_user_rank is not None and rank == current_user_rank + 1),
        is_premium=friend.is_premium,
        profile_picture_url=friend.profile_picture_url,
        streak_status_key=friend.status_key,
        streak_status_label=friend.status_label,
        streak_status_emoji=friend.status_emoji,
    )
