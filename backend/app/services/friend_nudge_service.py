"""Once-a-day nudges between friends: a single push that says "time for a session"."""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import FriendNudge, User, utcnow
from app.services import push_templates
from app.services.friend_graph import friend_user_ids
from app.services.kpi_tracker import track_event
from app.services.push_dispatch import schedule_push_to_user
from app.services.push_links import push_data_friend_nudge


class FriendNudgeError(ValueError):
    pass


class SelfNudgeError(FriendNudgeError):
    pass


class NudgeFriendRequiredError(FriendNudgeError):
    pass


class AlreadyNudgedTodayError(FriendNudgeError):
    pass


def _utc_day_key(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).date().isoformat()


def next_nudge_available_at(moment: datetime) -> datetime:
    """Nudges reset at UTC midnight, so everyone shares the same daily window."""
    tomorrow = moment.astimezone(timezone.utc).date() + timedelta(days=1)
    return datetime.combine(tomorrow, time.min, tzinfo=timezone.utc)


def has_nudged_today(db: Session, sender_user_id: int, recipient_user_id: int) -> bool:
    return (
        db.scalar(
            select(FriendNudge.id).where(
                FriendNudge.sender_user_id == sender_user_id,
                FriendNudge.recipient_user_id == recipient_user_id,
                FriendNudge.day_key == _utc_day_key(utcnow()),
            )
        )
        is not None
    )


def send_friend_nudge(
    settings: Settings,
    db: Session,
    sender: User,
    recipient_user_id: int,
) -> datetime:
    """Record the nudge and push it to the friend; returns when the next nudge is allowed."""
    if recipient_user_id == sender.id:
        raise SelfNudgeError
    if recipient_user_id not in set(friend_user_ids(db, sender.id)):
        raise NudgeFriendRequiredError
    now = utcnow()
    if has_nudged_today(db, sender.id, recipient_user_id):
        raise AlreadyNudgedTodayError
    db.add(
        FriendNudge(
            sender_user_id=sender.id,
            recipient_user_id=recipient_user_id,
            day_key=_utc_day_key(now),
            created_at=now,
        )
    )
    track_event(db, "friend_nudge_sent", user_id=sender.id, props={"target_user_id": recipient_user_id})
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise AlreadyNudgedTodayError from error
    title, body = push_templates.friend_nudge(sender.username)
    schedule_push_to_user(
        settings,
        recipient_user_id,
        title,
        body,
        push_data_friend_nudge(sender.id),
        label="friend-nudge",
    )
    return next_nudge_available_at(now)
