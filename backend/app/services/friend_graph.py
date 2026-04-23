from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Friendship, FriendshipStatus


def friend_user_ids(db: Session, user_id: int) -> list[int]:
    """Return accepted friend user IDs for the given user."""
    rows = db.scalars(
        select(Friendship).where(
            Friendship.status == FriendshipStatus.accepted,
            or_(Friendship.user_id == user_id, Friendship.friend_id == user_id),
        )
    ).all()
    out: list[int] = []
    for row in rows:
        out.append(row.friend_id if row.user_id == user_id else row.user_id)
    return out
