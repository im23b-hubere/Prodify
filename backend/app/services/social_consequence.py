from __future__ import annotations

import logging
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import Friendship, FriendshipStatus, GrowthEvent, StreakBreakNotifyDedupe, User, utcnow
from app.services.kpi_tracker import track_event
from app.services.push_dispatch import send_ping

_log = logging.getLogger(__name__)


def _active_friend_ids(db: Session, user_id: int) -> list[int]:
    rows = db.scalars(
        select(Friendship).where(
            Friendship.status == FriendshipStatus.accepted,
            or_(Friendship.user_id == user_id, Friendship.friend_id == user_id),
        )
    ).all()
    ids: list[int] = []
    for row in rows:
        ids.append(row.friend_id if row.user_id == user_id else row.user_id)
    return ids


def notify_friends_of_streak_break(user_id: int, streak_days: int) -> None:
    """
    Emit social consequence event + push friends when a streak breaks.

    Idempotent under concurrency: claim a DB row (user_id, utc_day_key) first; only one
    notifier succeeds per user per UTC calendar day. Uses a dedicated session so callers
    are not tied to request transaction boundaries.
    """
    if streak_days <= 0:
        return

    day_key = utcnow().date().isoformat()
    with SessionLocal() as db:
        try:
            db.add(StreakBreakNotifyDedupe(user_id=user_id, utc_day_key=day_key, created_at=utcnow()))
            db.flush()
        except IntegrityError:
            db.rollback()
            return

        user = db.get(User, user_id)
        if user is None:
            db.rollback()
            return

        friend_ids = _active_friend_ids(db, user_id)
        for fid in friend_ids:
            try:
                send_ping(
                    settings,
                    db,
                    fid,
                    f"{user.username}'s streak just ended",
                    f"{user.username}'s {streak_days}-day streak just ended 💔 Send support to restart strong.",
                    data={"kind": "streak_broken", "user_id": str(user_id), "streak_days": str(streak_days)},
                )
            except Exception:
                _log.exception("push streak break friend_id=%s", fid)

        track_event(
            db,
            "streak_broken",
            user_id=user_id,
            props={"streak_days": streak_days, "friends_notified": len(friend_ids)},
        )
        try:
            db.commit()
        except Exception:
            _log.exception("streak_break_notify_commit_failed user_id=%s", user_id)
            db.rollback()


def maybe_notify_streak_break_on_transition(prev_streak: int, new_streak: int, user_id: int) -> None:
    """Call from write paths when reconciled streak drops from positive to zero."""
    if prev_streak > 0 and new_streak == 0:
        notify_friends_of_streak_break(user_id, prev_streak)
