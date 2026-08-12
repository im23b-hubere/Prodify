"""Build the shared friend activity feed from sessions and growth events."""

import json

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import GrowthEvent, ProductionSession, SocialComment, SocialReaction, Streak, User, utcnow
from app.schemas import FriendActivityPublic
from app.services.friend_graph import friend_user_ids
from app.services.streak_status_service import streak_status_for_days


def build_friend_activity(db: Session, viewer_id: int, requested_limit: int) -> list[FriendActivityPublic]:
    limit = max(1, min(requested_limit, 50))
    user_ids = [viewer_id, *friend_user_ids(db, viewer_id)]
    sessions = _recent_sessions(db, user_ids, limit)
    events = _recent_events(db, user_ids, limit)
    reactions, comments, viewer_reactions = _session_engagement(db, sessions, viewer_id)
    users = _user_metadata(db, user_ids)

    items = [
        *[_session_item(row, users, reactions, comments, viewer_reactions) for row in sessions],
        *[_event_item(event, users) for event in events],
    ]
    items.sort(key=lambda item: item.activity_at, reverse=True)
    return items[:limit]


def _recent_sessions(db: Session, user_ids: list[int], limit: int) -> list[ProductionSession]:
    return list(
        db.scalars(
            select(ProductionSession)
            .where(
                ProductionSession.user_id.in_(user_ids),
                ProductionSession.deleted_at.is_(None),
                ProductionSession.stopped_at.is_not(None),
                ProductionSession.duration_seconds.is_not(None),
            )
            .order_by(func.coalesce(ProductionSession.stopped_at, ProductionSession.started_at).desc())
            .limit(limit * 2)
        ).all()
    )


def _recent_events(db: Session, user_ids: list[int], limit: int) -> list[GrowthEvent]:
    return list(
        db.scalars(
            select(GrowthEvent)
            .where(
                GrowthEvent.user_id.in_(user_ids),
                GrowthEvent.event_name.in_(("streak_broken", "commitment_published")),
            )
            .order_by(GrowthEvent.created_at.desc())
            .limit(limit * 2)
        ).all()
    )


def _session_engagement(
    db: Session,
    sessions: list[ProductionSession],
    viewer_id: int,
) -> tuple[dict[int, int], dict[int, int], dict[int, str]]:
    session_ids = [row.id for row in sessions]
    if not session_ids:
        return {}, {}, {}

    reaction_rows = db.execute(
        select(SocialReaction.target_id, func.count(SocialReaction.id))
        .where(SocialReaction.target_type == "session", SocialReaction.target_id.in_(session_ids))
        .group_by(SocialReaction.target_id)
    ).all()
    comment_rows = db.execute(
        select(SocialComment.target_id, func.count(SocialComment.id))
        .where(SocialComment.target_type == "session", SocialComment.target_id.in_(session_ids))
        .group_by(SocialComment.target_id)
    ).all()
    viewer_rows = db.scalars(
        select(SocialReaction).where(
            SocialReaction.target_type == "session",
            SocialReaction.target_id.in_(session_ids),
            SocialReaction.user_id == viewer_id,
        )
    ).all()
    return (
        {int(target_id): int(count) for target_id, count in reaction_rows},
        {int(target_id): int(count) for target_id, count in comment_rows},
        {int(row.target_id): row.emoji for row in viewer_rows},
    )


def _user_metadata(db: Session, user_ids: list[int]) -> dict[int, dict[str, str | None]]:
    streaks = db.scalars(select(Streak).where(Streak.user_id.in_(user_ids))).all()
    streak_by_user = {row.user_id: row for row in streaks}
    metadata: dict[int, dict[str, str | None]] = {}
    for user in db.scalars(select(User).where(User.id.in_(user_ids))).all():
        streak = streak_by_user.get(user.id)
        streak_days = int(streak.current_streak or 0) if streak else 0
        inactive_days = 0
        if streak and streak.last_session_date:
            inactive_days = max((utcnow().date() - streak.last_session_date.date()).days, 0)
        key, label, emoji = streak_status_for_days(streak_days, inactive_days)
        metadata[user.id] = {
            "username": user.username,
            "profile_picture_url": user.profile_picture_url,
            "streak_status_key": key,
            "streak_status_label": label,
            "streak_status_emoji": emoji,
        }
    return metadata


def _session_item(
    session: ProductionSession,
    users: dict[int, dict[str, str | None]],
    reactions: dict[int, int],
    comments: dict[int, int],
    viewer_reactions: dict[int, str],
) -> FriendActivityPublic:
    user = users.get(session.user_id, {})
    return FriendActivityPublic(
        session_id=session.id,
        user_id=session.user_id,
        username=user.get("username") or "?",
        profile_picture_url=user.get("profile_picture_url"),
        session_type=session.session_type,
        activity_at=session.stopped_at or session.started_at,
        status="completed",
        completed_at=session.stopped_at,
        duration_seconds=int(session.duration_seconds or 0),
        reactions_count=reactions.get(session.id, 0),
        comments_count=comments.get(session.id, 0),
        viewer_reaction=viewer_reactions.get(session.id),
        **_streak_fields(user),
    )


def _event_item(event: GrowthEvent, users: dict[int, dict[str, str | None]]) -> FriendActivityPublic:
    user_id = int(event.user_id or 0)
    user = users.get(user_id, {})
    username = user.get("username") or "?"
    properties = _event_properties(event)
    status, message, streak_days = _event_description(event.event_name, username, properties)
    return FriendActivityPublic(
        session_id=-int(event.id),
        user_id=user_id,
        username=username,
        profile_picture_url=user.get("profile_picture_url"),
        session_type=status,
        activity_at=event.created_at,
        status=status,
        completed_at=event.created_at,
        duration_seconds=None,
        reactions_count=0,
        comments_count=0,
        viewer_reaction=None,
        event_message=message,
        streak_break_days=streak_days,
        **_streak_fields(user),
    )


def _event_properties(event: GrowthEvent) -> dict:
    try:
        parsed = json.loads(event.event_props_json or "{}")
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _event_description(event_name: str, username: str, properties: dict) -> tuple[str, str, int | None]:
    if event_name == "streak_broken":
        days = _integer_property(properties, "streak_days") or None
        detail = f"{days}-day streak ended 💔" if days else "Streak ended 💔"
        return "streak_broken", f"{username}'s streak just ended · {detail}", days
    target = _integer_property(properties, "target_sessions")
    witnesses = _integer_property(properties, "witness_count")
    suffix = f" · {witnesses} witnesses" if witnesses else ""
    return "commitment_published", f"{username} published a commitment: {target} sessions this week{suffix}", None


def _integer_property(properties: dict, key: str) -> int:
    value = properties.get(key, 0)
    return int(value) if str(value).isdigit() else 0


def _streak_fields(user: dict[str, str | None]) -> dict[str, str]:
    return {
        "streak_status_key": user.get("streak_status_key") or "starting",
        "streak_status_label": user.get("streak_status_label") or "STARTING",
        "streak_status_emoji": user.get("streak_status_emoji") or "🌱",
    }
