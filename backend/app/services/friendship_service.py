import logging
from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Friendship, FriendshipStatus, User
from app.schemas import (
    FriendIncomingPublic,
    FriendPostAcceptActionPublic,
    FriendStatusPublic,
)
from app.services import push_templates
from app.services.engagement.events import EngagementEvent
from app.services.kpi_tracker import track_event
from app.services.progression_service import grant_xp
from app.services.push_dispatch import schedule_push_to_user
from app.services.push_links import push_data_friend_accepted, push_data_friend_request
from app.services.user_block_service import hidden_user_ids, is_blocked_between

logger = logging.getLogger(__name__)


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
    if target is None or is_blocked_between(db, user_id, target.id):
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
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        existing = _friendship_between(db, user_id, target.id)
        if existing is not None:
            _raise_existing_relationship(existing, user_id)
        raise FriendshipOperationError("friendship conflict") from error
    db.refresh(friendship)
    sender = db.get(User, user_id)
    if sender is not None:
        _schedule_friend_push(
            target.id,
            *push_templates.friend_request(sender.username),
            push_data_friend_request(user_id),
            label="friend-request",
        )
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
        return FriendStatusPublic(
            status="accepted",
            username=target.username,
            friendship_id=friendship.id,
        )
    direction: Literal["outgoing", "incoming"] = (
        "outgoing" if friendship.user_id == user.id else "incoming"
    )
    return FriendStatusPublic(
        status="pending",
        username=target.username,
        pending_direction=direction,
        friendship_id=friendship.id,
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
    hidden = hidden_user_ids(db, user_id)
    requesters = {
        user.id: user
        for user in db.scalars(
            select(User).where(User.id.in_([row.user_id for row in friendships]))
        ).all()
    }
    requests: list[FriendIncomingPublic] = []
    for friendship in friendships:
        requester = requesters.get(friendship.user_id)
        if requester is not None and requester.id not in hidden:
            requests.append(
                FriendIncomingPublic(
                    id=friendship.id,
                    user_id=friendship.user_id,
                    username=requester.username,
                    profile_picture_url=requester.profile_picture_url,
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
        or is_blocked_between(db, user.id, friendship.user_id)
    ):
        raise FriendRequestNotFoundError
    friendship.status = FriendshipStatus.accepted
    requester = db.get(User, friendship.user_id)
    if requester is not None:
        _grant_friendship_bonuses(requester)
    _grant_friendship_bonuses(user)
    track_event(db, EngagementEvent.FRIEND_ADDED, user.id, {"friend_id": friendship.user_id})
    track_event(db, EngagementEvent.FRIEND_ADDED, friendship.user_id, {"friend_id": user.id})
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
    _schedule_friend_push(
        friendship.user_id,
        *push_templates.friend_accepted(user.username),
        push_data_friend_accepted(user.id),
        label="friend-accepted",
    )
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


def _schedule_friend_push(
    user_id: int,
    title: str,
    body: str,
    data: dict[str, str],
    *,
    label: str,
) -> None:
    try:
        schedule_push_to_user(settings, user_id, title, body, data, label=label)
    except Exception:
        logger.exception("schedule %s push failed user_id=%s", label, user_id)
