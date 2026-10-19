from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User, UserProgression
from app.schemas import FriendProgressionEntryPublic, FriendsProgressionPublic
from app.services.friend_graph import friend_user_ids
from app.services.progression_service import XP_LEVEL_CATALOG_MAX


def build_friends_progression(db: Session, current_user_id: int) -> FriendsProgressionPublic:
    friend_ids = friend_user_ids(db, current_user_id)
    if not friend_ids:
        return FriendsProgressionPublic(friends=[])

    users = {
        user.id: user
        for user in db.scalars(select(User).where(User.id.in_(friend_ids))).all()
    }
    levels = {
        row.user_id: int(row.current_level or 1)
        for row in db.scalars(
            select(UserProgression).where(UserProgression.user_id.in_(friend_ids))
        ).all()
    }

    friends = [
        FriendProgressionEntryPublic(
            user_id=user.id,
            username=user.username,
            profile_picture_url=user.profile_picture_url,
            level=_clamped_level(levels.get(user.id)),
        )
        for user_id in friend_ids
        if (user := users.get(user_id)) is not None
    ]
    friends.sort(key=lambda entry: entry.username.lower())
    return FriendsProgressionPublic(friends=friends)


def _clamped_level(raw: int | None) -> int:
    if raw is None:
        return 1
    return max(1, min(XP_LEVEL_CATALOG_MAX, raw))
