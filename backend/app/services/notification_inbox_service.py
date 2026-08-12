"""Assemble notification inbox items from independent domain sources."""

from datetime import datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy import and_, desc, select
from sqlalchemy.orm import Session

from app.models import Friendship, FriendshipStatus, NotificationReadState, ProductionSession, SocialComment, Streak, User, UserAchievement, utcnow
from app.contracts.notifications import NotificationInboxItemPublic


def build_notification_inbox(
    db: Session,
    user_id: int,
    requested_limit: int,
    since: datetime | None,
) -> list[NotificationInboxItemPublic]:
    limit = max(1, min(requested_limit, 100))
    now = utcnow()
    last_read_at = _last_read_at(db, user_id)
    candidates = [
        *_friend_request_items(db, user_id),
        *_comment_items(db, user_id),
        *_achievement_items(db, user_id),
        *_streak_risk_items(db, user_id, now),
    ]

    items: list[NotificationInboxItemPublic] = []
    seen_ids: set[str] = set()
    for item in candidates:
        if since and item.created_at <= since or item.id in seen_ids:
            continue
        if last_read_at is not None:
            item.read = item.created_at <= last_read_at
        seen_ids.add(item.id)
        items.append(item)
    items.sort(key=lambda item: item.created_at, reverse=True)
    return items[:limit]


def mark_inbox_read(db: Session, user_id: int, target: datetime | None) -> None:
    marked_at = target or utcnow()
    state = db.scalar(select(NotificationReadState).where(NotificationReadState.user_id == user_id))
    if state is None:
        state = NotificationReadState(user_id=user_id, last_read_at=marked_at, updated_at=utcnow())
    else:
        previous = _aware(state.last_read_at) if state.last_read_at else marked_at
        state.last_read_at = max(previous, marked_at)
        state.updated_at = utcnow()
    db.add(state)
    db.commit()


def _friend_request_items(db: Session, user_id: int) -> Iterable[NotificationInboxItemPublic]:
    requests = db.scalars(
        select(Friendship)
        .where(Friendship.friend_id == user_id, Friendship.status == FriendshipStatus.pending)
        .order_by(desc(Friendship.created_at))
        .limit(20)
    ).all()
    requester_ids = [row.user_id for row in requests]
    usernames = (
        {user.id: user.username for user in db.scalars(select(User).where(User.id.in_(requester_ids))).all()}
        if requester_ids
        else {}
    )
    for request in requests:
        username = usernames.get(request.user_id, "A producer")
        created_at = _aware(request.created_at)
        yield NotificationInboxItemPublic(
            id=f"friend-request-{request.id}",
            category="social",
            priority="normal",
            title="New friend request",
            body=f"{username} sent you a friend request.",
            title_key="notificationsUi.friendRequestTitle",
            body_key="notificationsUi.friendRequestBody",
            body_params={"username": username},
            created_at=created_at,
            expires_at=created_at + timedelta(days=7),
            action_label="Open friends",
            action_route="/(tabs)/friends",
        )


def _comment_items(db: Session, user_id: int) -> Iterable[NotificationInboxItemPublic]:
    comments = db.scalars(
        select(SocialComment)
        .join(
            ProductionSession,
            and_(SocialComment.target_type == "session", SocialComment.target_id == ProductionSession.id),
        )
        .where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            SocialComment.author_id != user_id,
        )
        .order_by(desc(SocialComment.created_at))
        .limit(25)
    ).all()
    seen_sessions: set[int] = set()
    for comment in comments:
        if comment.target_id in seen_sessions:
            continue
        seen_sessions.add(comment.target_id)
        created_at = _aware(comment.created_at)
        yield NotificationInboxItemPublic(
            id=f"session-comment-{comment.target_id}-{int(created_at.timestamp())}",
            category="social",
            priority="normal",
            title="New comment on your session",
            body="A producer commented on one of your sessions.",
            title_key="notificationsUi.newCommentTitle",
            body_key="notificationsUi.newCommentBody",
            body_params={"count": 1},
            created_at=created_at,
            expires_at=created_at + timedelta(days=5),
            action_label="Open session",
            action_route=f"/session/{comment.target_id}",
        )


def _achievement_items(db: Session, user_id: int) -> Iterable[NotificationInboxItemPublic]:
    achievements = db.scalars(
        select(UserAchievement)
        .where(UserAchievement.user_id == user_id)
        .order_by(desc(UserAchievement.unlocked_at))
        .limit(12)
    ).all()
    for achievement in achievements:
        unlocked_at = _aware(achievement.unlocked_at)
        yield NotificationInboxItemPublic(
            id=f"achievement-{achievement.id}",
            category="achievement",
            priority="high",
            title="Milestone reached",
            body=f"{achievement.achievement_type.replace('_', ' ').title()} unlocked.",
            title_key="dashboard.milestoneNotifTitle",
            created_at=unlocked_at,
            expires_at=unlocked_at + timedelta(days=30),
            action_label="Open profile",
            action_route="/(tabs)/profile",
        )


def _streak_risk_items(
    db: Session,
    user_id: int,
    now: datetime,
) -> Iterable[NotificationInboxItemPublic]:
    streak = db.scalar(select(Streak).where(Streak.user_id == user_id))
    if not streak or int(streak.current_streak or 0) <= 0 or streak.last_session_date is None:
        return
    if (now.date() - _aware(streak.last_session_date).date()).days < 1:
        return
    yield NotificationInboxItemPublic(
        id=f"streak-risk-{now.date().isoformat()}",
        category="streak",
        priority="critical",
        title="Streak at risk",
        body="Start one short session today to protect your streak.",
        title_key="notificationsUi.streakRiskTitle",
        body_key="notificationsUi.streakRiskBody",
        created_at=now,
        expires_at=now + timedelta(days=1),
        action_label="Start session",
        action_route="/session/setup",
    )


def _last_read_at(db: Session, user_id: int) -> datetime | None:
    state = db.scalar(select(NotificationReadState).where(NotificationReadState.user_id == user_id))
    return _aware(state.last_read_at) if state and state.last_read_at else None


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
