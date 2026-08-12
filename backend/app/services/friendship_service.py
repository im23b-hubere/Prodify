from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Friendship, FriendshipStatus, User
from app.schemas import (
    FriendIncomingPublic,
    FriendPostAcceptActionPublic,
    FriendStatusPublic,
)
from app.services.kpi_tracker import track_event
from app.services.progression_service import grant_xp


class FriendshipOperationError(ValueError):
    pass


class FriendUserNotFoundError(FriendshipOperationError):
    pass


class SelfFriendRequestError(FriendshipOperationError):
    pass


class AlreadyFriendsError(FriendshipOperationError):
    pass


class OutgoingRequestPendingError(FriendshipOperationError):
    pass


class IncomingRequestPendingError(FriendshipOperationError):
    pass


class FriendRequestNotFoundError(FriendshipOperationError):
    pass


class FriendshipNotFoundError(FriendshipOperationError):
    pass


class FriendshipAccessDeniedError(FriendshipOperationError):
    pass


def send_friend_request(db: Session, user_id: int, username: str) -> Friendship:
    normalized_username = username.strip().lower()
    target = db.scalar(select(User).where(func.lower(User.username) == normalized_username))
    if target is None:
        raise FriendUserNotFoundError
    if target.id == user_id:
        raise SelfFriendRequestError
    existing = _friendship_between(db, user_id, target.id)
    if existing is not None:
        _raise_existing_relationship(existing, user_id)
    friendship = Friendship(
        user_id=user_id,
        friend_id=target.id,
        status=FriendshipStatus.pending,
    )
    db.add(friendship)
    track_event(db, "invite_sent", user_id, {"friend_id": target.id})
    db.commit()
    db.refresh(friendship)
    return friendship


def friendship_status(db: Session, user: User, target_user_id: int) -> FriendStatusPublic:
    if target_user_id == user.id:
        return FriendStatusPublic(status="self", username=user.username)
    target = db.get(User, target_user_id)
    if target is None:
        raise FriendUserNotFoundError
    friendship = _friendship_between(db, user.id, target_user_id)
    if friendship is None:
        return FriendStatusPublic(status="none", username=target.username)
    if friendship.status == FriendshipStatus.accepted:
        return FriendStatusPublic(status="accepted", username=target.username)
    direction: Literal["outgoing", "incoming"] = (
        "outgoing" if friendship.user_id == user.id else "incoming"
    )
    return FriendStatusPublic(
        status="pending",
        username=target.username,
        pending_direction=direction,
    )


def list_incoming_requests(db: Session, user_id: int) -> list[FriendIncomingPublic]:
    friendships = db.scalars(
        select(Friendship)
        .where(
            Friendship.friend_id == user_id,
            Friendship.status == FriendshipStatus.pending,
        )
        .order_by(Friendship.created_at.desc())
    ).all()
    requests: list[FriendIncomingPublic] = []
    for friendship in friendships:
        requester = db.get(User, friendship.user_id)
        if requester is not None:
            requests.append(
                FriendIncomingPublic(
                    id=friendship.id,
                    user_id=friendship.user_id,
                    username=requester.username,
                    created_at=friendship.created_at,
                )
            )
    return requests


def accept_friend_request(db: Session, user: User, friendship_id: int) -> Friendship:
    friendship = db.get(Friendship, friendship_id)
    if (
        friendship is None
        or friendship.friend_id != user.id
        or friendship.status != FriendshipStatus.pending
    ):
        raise FriendRequestNotFoundError
    friendship.status = FriendshipStatus.accepted
    requester = db.get(User, friendship.user_id)
    if requester is not None:
        _grant_friendship_bonuses(requester)
    _grant_friendship_bonuses(user)
    grant_xp(
        db,
        user.id,
        10,
        source_type="friend_request_accept",
        source_id=str(friendship.id),
        meta={"friend_user_id": friendship.user_id},
    )
    db.commit()
    db.refresh(friendship)
    return friendship


def delete_friendship(db: Session, user_id: int, friendship_id: int) -> None:
    friendship = _accessible_friendship(db, user_id, friendship_id)
    db.delete(friendship)
    db.commit()


def post_accept_actions(
    db: Session,
    user_id: int,
    friendship_id: int,
) -> list[FriendPostAcceptActionPublic]:
    friendship = _accessible_friendship(db, user_id, friendship_id)
    if friendship.status != FriendshipStatus.accepted:
        raise FriendshipNotFoundError
    return [
        FriendPostAcceptActionPublic(
            key="start_challenge",
            title="Start a shared challenge",
            cta_label="Create challenge",
            route_hint="/(tabs)/friends",
        ),
        FriendPostAcceptActionPublic(
            key="set_buddy",
            title="Become accountability buddies",
            cta_label="Invite as buddy",
            route_hint="/(tabs)/friends",
        ),
        FriendPostAcceptActionPublic(
            key="publish_commitment",
            title="Commit to this week's sessions",
            cta_label="Set commitment",
            route_hint="/(tabs)/friends",
        ),
    ]


def _friendship_between(db: Session, first_user_id: int, second_user_id: int) -> Friendship | None:
    return db.scalar(
        select(Friendship).where(
            or_(
                (Friendship.user_id == first_user_id) & (Friendship.friend_id == second_user_id),
                (Friendship.user_id == second_user_id) & (Friendship.friend_id == first_user_id),
            )
        )
    )


def _accessible_friendship(db: Session, user_id: int, friendship_id: int) -> Friendship:
    friendship = db.get(Friendship, friendship_id)
    if friendship is None:
        raise FriendshipNotFoundError
    if friendship.user_id != user_id and friendship.friend_id != user_id:
        raise FriendshipAccessDeniedError
    return friendship


def _raise_existing_relationship(friendship: Friendship, user_id: int) -> None:
    if friendship.status == FriendshipStatus.accepted:
        raise AlreadyFriendsError
    if friendship.user_id == user_id:
        raise OutgoingRequestPendingError
    raise IncomingRequestPendingError


def _grant_friendship_bonuses(user: User) -> None:
    user.bonus_rescues = int(user.bonus_rescues or 0) + 1
    user.bonus_challenge_slots = int(user.bonus_challenge_slots or 0) + 1
