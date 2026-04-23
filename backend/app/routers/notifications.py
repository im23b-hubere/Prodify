from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    Friendship,
    FriendshipStatus,
    NotificationReadState,
    ProductionSession,
    PushToken,
    SocialComment,
    Streak,
    User,
    UserAchievement,
    utcnow,
)
from app.schemas import (
    NotificationInboxItemPublic,
    NotificationInboxReadBody,
    PushBulkResultPublic,
    PushPingBody,
    PushTokenRegister,
    SmartNudgeBody,
)
from app.services import push_templates
from app.services.kpi_tracker import track_event
from app.services.push_dispatch import send_ping
from app.services.push_links import push_data_dashboard

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/inbox", response_model=list[NotificationInboxItemPublic])
def inbox_feed(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 40,
    since_ms: int | None = None,
):
    now = utcnow()
    safe_limit = max(1, min(limit, 100))
    since_dt = (
        datetime.fromtimestamp(since_ms / 1000.0, tz=timezone.utc)
        if isinstance(since_ms, int) and since_ms > 0
        else None
    )
    read_state = db.scalar(select(NotificationReadState).where(NotificationReadState.user_id == current.id))
    last_read_at = read_state.last_read_at if read_state and read_state.last_read_at else None
    items: list[NotificationInboxItemPublic] = []
    by_id: set[str] = set()

    def add_item(item: NotificationInboxItemPublic) -> None:
        if since_dt and item.created_at <= since_dt:
            return
        if item.id in by_id:
            return
        if last_read_at is not None:
            item.read = item.created_at <= last_read_at
        by_id.add(item.id)
        items.append(item)

    pending_requests = db.scalars(
        select(Friendship)
        .where(Friendship.friend_id == current.id, Friendship.status == FriendshipStatus.pending)
        .order_by(desc(Friendship.created_at))
        .limit(20)
    ).all()
    requester_ids = [row.user_id for row in pending_requests]
    requesters = (
        {u.id: u.username for u in db.scalars(select(User).where(User.id.in_(requester_ids))).all()}
        if requester_ids
        else {}
    )
    for row in pending_requests:
        username = requesters.get(row.user_id, "A producer")
        created_at = row.created_at if row.created_at.tzinfo else row.created_at.replace(tzinfo=timezone.utc)
        add_item(
            NotificationInboxItemPublic(
                id=f"friend-request-{row.id}",
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
        )

    comment_rows = db.scalars(
        select(SocialComment)
        .join(
            ProductionSession,
            and_(
                SocialComment.target_type == "session",
                SocialComment.target_id == ProductionSession.id,
            ),
        )
        .where(
            ProductionSession.user_id == current.id,
            ProductionSession.deleted_at.is_(None),
            SocialComment.author_id != current.id,
        )
        .order_by(desc(SocialComment.created_at))
        .limit(25)
    ).all()
    if comment_rows:
        seen_sessions: set[int] = set()
        for comment in comment_rows:
            if comment.target_id in seen_sessions:
                continue
            seen_sessions.add(comment.target_id)
            created_at = comment.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            add_item(
                NotificationInboxItemPublic(
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
            )

    achievements = db.scalars(
        select(UserAchievement)
        .where(UserAchievement.user_id == current.id)
        .order_by(desc(UserAchievement.unlocked_at))
        .limit(12)
    ).all()
    for achievement in achievements:
        unlocked_at = achievement.unlocked_at
        if unlocked_at.tzinfo is None:
            unlocked_at = unlocked_at.replace(tzinfo=timezone.utc)
        add_item(
            NotificationInboxItemPublic(
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
        )

    streak = db.scalar(select(Streak).where(Streak.user_id == current.id))
    if streak and int(streak.current_streak or 0) > 0 and streak.last_session_date is not None:
        last = streak.last_session_date
        last_aware = last if last.tzinfo else last.replace(tzinfo=timezone.utc)
        if (now.date() - last_aware.date()).days >= 1:
            add_item(
                NotificationInboxItemPublic(
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
            )

    items.sort(key=lambda item: item.created_at, reverse=True)
    return items[:safe_limit]


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_notifications_read(
    body: NotificationInboxReadBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    target = (
        datetime.fromtimestamp(body.up_to_ms / 1000.0, tz=timezone.utc)
        if isinstance(body.up_to_ms, int) and body.up_to_ms > 0
        else utcnow()
    )
    row = db.scalar(select(NotificationReadState).where(NotificationReadState.user_id == current.id))
    if row is None:
        row = NotificationReadState(user_id=current.id, last_read_at=target, updated_at=utcnow())
        db.add(row)
    else:
        previous = row.last_read_at or target
        row.last_read_at = max(previous, target)
        row.updated_at = utcnow()
        db.add(row)
    db.commit()
    return None


@router.post("/register-token", status_code=status.HTTP_204_NO_CONTENT)
def register_push_token(
    body: PushTokenRegister,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if not settings.feature_flag_push_notifications_enabled:
        raise HTTPException(status_code=503, detail="Push notifications are temporarily disabled")

    token = body.token.strip()

    channel = body.channel if body.channel in ("expo", "fcm") else "expo"

    existing = db.scalar(

        select(PushToken).where(

            PushToken.user_id == current.id,

            PushToken.token == token,

            PushToken.channel == channel,

        )

    )

    if existing is not None:
        existing.platform = body.platform.strip()[:32] or "unknown"
        existing.is_active = 1
        existing.last_used_at = utcnow()
        db.add(existing)
        db.commit()
        return None

    db.add(
        PushToken(
            user_id=current.id,
            token=token,
            platform=body.platform.strip()[:32] or "unknown",
            channel=channel,
            is_active=1,
            created_at=utcnow(),
            last_used_at=utcnow(),
        )
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        row = db.scalar(
            select(PushToken).where(
                PushToken.user_id == current.id,
                PushToken.token == token,
                PushToken.channel == channel,
            )
        )
        if row is not None:
            row.platform = body.platform.strip()[:32] or "unknown"
            row.is_active = 1
            row.last_used_at = utcnow()
            db.add(row)
            db.commit()
        else:
            raise

    return None





@router.post("/ping-self", response_model=PushBulkResultPublic)
def ping_self_push(
    body: PushPingBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if not settings.feature_flag_push_notifications_enabled:
        raise HTTPException(status_code=503, detail="Push notifications are temporarily disabled")

    """Send a test push using Expo and/or FCM tokens for the current user."""

    ping_data: dict[str, str] | None = None

    if body.template == "session_demo":

        title, text = push_templates.session_demo()

        ping_data = {**push_data_dashboard(), "kind": "session_demo"}

    elif body.template == "streak_demo":

        title, text = push_templates.streak_reminder(body.streak_days or 7)

        ping_data = {**push_data_dashboard(), "kind": "streak_demo"}

    else:

        d_title, d_body = push_templates.admin_ping_default()

        title = body.title or d_title

        text = body.body or d_body

        ping_data = {**push_data_dashboard(), "kind": "test_ping"}



    attempted, ok, msg = send_ping(settings, db, current.id, title, text, data=ping_data)
    db.commit()

    if attempted == 0 and msg and "no push" in msg.lower():

        raise HTTPException(status_code=400, detail=msg)

    if attempted > 0 and ok == 0:

        raise HTTPException(status_code=503, detail=msg or "All push deliveries failed")

    return PushBulkResultPublic(attempted=attempted, delivered_ok=ok, message=msg)


@router.post("/smart-nudge", response_model=PushBulkResultPublic)
def smart_nudge(
    body: SmartNudgeBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if not settings.feature_flag_push_notifications_enabled:
        raise HTTPException(status_code=503, detail="Push notifications are temporarily disabled")
    if not settings.feature_flag_smart_nudges_enabled:
        raise HTTPException(status_code=503, detail="Smart nudges are temporarily disabled")
    kind = body.kind
    if kind == "best_time":
        hour = body.hour if body.hour is not None else 20
        title, text = push_templates.best_time_nudge(hour)
    elif kind == "forecast_risk":
        rem = body.remaining_sessions if body.remaining_sessions is not None else 2
        days = body.days_left if body.days_left is not None else 2
        title, text = push_templates.forecast_risk_nudge(rem, days)
    else:
        days = body.days_inactive if body.days_inactive is not None else 3
        title, text = push_templates.inactivity_nudge(days)

    attempted, ok, msg = send_ping(settings, db, current.id, title, text, data=push_data_dashboard())
    track_event(db, "smart_notification_sent", current.id, {"kind": kind, "attempted": attempted, "delivered": ok})
    db.commit()
    return PushBulkResultPublic(attempted=attempted, delivered_ok=ok, message=msg)


