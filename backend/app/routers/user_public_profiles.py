"""Read-only user profile, reliability, stats, and session endpoints."""

from collections import Counter, defaultdict
from datetime import datetime, time, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.contracts.insights import HeatmapDayPublic
from app.models import Friendship, FriendshipStatus, ProductionSession, Streak, User, UserAchievement, utcnow
from app.schemas import (
    AchievementUnlockedPublic,
    ReliabilityScorePublic,
    UserFriendProfilePublic,
    UserFriendStatsPublic,
    UserPublicSessionItem,
)
from app.services.identity_tags import profile_identity_tags
from app.services.reliability_service import ReliabilityScoreService
from app.services.streak_reconcile_service import compute_streak_counts_for_display
from app.services.streak_status_service import streak_status_for_days
from app.timeutil import as_utc_aware

router = APIRouter()


def _accepted_friendship(db: Session, a: int, b: int) -> bool:
    if a == b:
        return True
    row = db.scalar(
        select(Friendship).where(
            Friendship.status == FriendshipStatus.accepted,
            or_(
                (Friendship.user_id == a) & (Friendship.friend_id == b),
                (Friendship.user_id == b) & (Friendship.friend_id == a),
            ),
        )
    )
    return row is not None


def _friends_count(db: Session, user_id: int) -> int:
    rows = db.scalars(
        select(Friendship).where(
            Friendship.status == FriendshipStatus.accepted,
            or_(Friendship.user_id == user_id, Friendship.friend_id == user_id),
        )
    ).all()
    return len(rows)


def _heatmap_days(db: Session, user_id: int) -> list[HeatmapDayPublic]:
    today = utcnow().date()
    start = today - timedelta(days=89)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)

    rows = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.started_at >= start_dt,
        )
    ).all()

    by_day: defaultdict[str, int] = defaultdict(int)
    for r in rows:
        k = as_utc_aware(r.started_at).date().isoformat()
        by_day[k] += int(r.duration_seconds or 0)

    out: list[HeatmapDayPublic] = []
    for i in range(90):
        d = start + timedelta(days=i)
        ds = d.isoformat()
        sec = by_day.get(ds, 0)
        if sec <= 0:
            lvl = 0
        elif sec < 1800:
            lvl = 1
        elif sec < 7200:
            lvl = 2
        elif sec < 18000:
            lvl = 3
        else:
            lvl = 4
        out.append(HeatmapDayPublic(date=ds, seconds=sec, intensity=lvl))
    return out


def _require_friend_profile(db: Session, current: User, target_id: int) -> User:
    target = db.get(User, target_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not _accepted_friendship(db, current.id, target_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not friends with this user")
    return target


@router.get("/{user_id}/profile", response_model=UserFriendProfilePublic)
def get_user_profile(
    user_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    user = _require_friend_profile(db, current, user_id)
    reliability = ReliabilityScoreService.calculate(user_id, db)

    completed = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()
    total_sessions = len(completed)

    streak_row = db.scalar(select(Streak).where(Streak.user_id == user_id))
    cur, longest = compute_streak_counts_for_display(db, user_id)
    inactive_days = 0
    if streak_row and streak_row.last_session_date:
        inactive_days = max((utcnow().date() - streak_row.last_session_date.date()).days, 0)
    status_key, status_label, status_emoji = streak_status_for_days(cur, inactive_days)

    return UserFriendProfilePublic(
        id=user.id,
        username=user.username,
        profile_picture_url=user.profile_picture_url,
        total_sessions=total_sessions,
        current_streak=cur,
        longest_streak=longest,
        friends_count=_friends_count(db, user_id),
        is_premium=bool(int(user.is_premium or 0)),
        identity_tags=profile_identity_tags(db, user_id),
        created_at=user.created_at,
        reliability_score=reliability.score,
        reliability_trend=reliability.trend,
        reliability_rank_percent=reliability.rank_percent,
        streak_status_key=status_key,
        streak_status_label=status_label,
        streak_status_emoji=status_emoji,
    )


@router.get("/me/reliability", response_model=ReliabilityScorePublic)
def get_my_reliability(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    result = ReliabilityScoreService.calculate(current.id, db)
    return ReliabilityScorePublic(
        score=result.score,
        trend=result.trend,
        rank_percent=result.rank_percent,
        consistency_90d=result.consistency_90d,
        completion_rate_90d=result.completion_rate_90d,
    )


@router.get("/{user_id}/stats", response_model=UserFriendStatsPublic)
def get_user_stats(
    user_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _require_friend_profile(db, current, user_id)

    sessions = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()

    total_sessions = len(sessions)
    total_minutes = sum(int(s.duration_seconds or 0) for s in sessions) / 60.0

    type_counts: Counter[str] = Counter((s.session_type or "beat_making") for s in sessions)

    day_counts: Counter[str] = Counter()
    for s in sessions:
        day_counts[as_utc_aware(s.started_at).strftime("%A")] += 1
    best_day = max(day_counts.items(), key=lambda x: x[1])[0] if day_counts else None

    cur, longest = compute_streak_counts_for_display(db, user_id)

    ach_rows = db.scalars(select(UserAchievement).where(UserAchievement.user_id == user_id)).all()
    achievements = [AchievementUnlockedPublic(id=r.achievement_type, unlocked_at=r.unlocked_at) for r in ach_rows]

    return UserFriendStatsPublic(
        total_hours=round(total_minutes / 60.0, 1),
        total_sessions=total_sessions,
        current_streak=cur,
        longest_streak=longest,
        type_breakdown=dict(type_counts),
        best_day=best_day,
        heatmap_days=_heatmap_days(db, user_id),
        achievements=achievements,
    )


@router.get("/{user_id}/sessions", response_model=list[UserPublicSessionItem])
def get_user_sessions(
    user_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 10,
):
    _require_friend_profile(db, current, user_id)
    if limit < 1:
        limit = 1
    if limit > 50:
        limit = 50

    rows = db.scalars(
        select(ProductionSession)
        .where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.stopped_at.is_not(None),
            ProductionSession.duration_seconds.is_not(None),
        )
        .order_by(ProductionSession.started_at.desc())
        .limit(limit)
    ).all()

    return [
        UserPublicSessionItem(
            id=r.id,
            session_type=r.session_type,
            duration_seconds=int(r.duration_seconds or 0),
            started_at=r.started_at,
            mood_level=r.mood_level,
        )
        for r in rows
    ]
