"""Blocking: once either user blocks the other, the pair stops seeing and reaching each other."""

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.contracts.social import BlockedUserPublic
from app.models import (
    BuddyRelationship,
    Friendship,
    SocialChallenge,
    SocialChallengeMember,
    User,
    UserBlock,
)
from app.services.social_challenge_service import cancel_challenge, invitee_user_id, load_challenge_meta


class BlockOperationError(ValueError):
    pass


class BlockTargetNotFoundError(BlockOperationError):
    pass


class SelfBlockError(BlockOperationError):
    pass


def block_user(db: Session, blocker_id: int, blocked_id: int) -> None:
    if blocker_id == blocked_id:
        raise SelfBlockError
    if db.get(User, blocked_id) is None:
        raise BlockTargetNotFoundError
    if _find_block(db, blocker_id, blocked_id) is None:
        db.add(UserBlock(blocker_id=blocker_id, blocked_id=blocked_id))
    _sever_social_ties(db, blocker_id, blocked_id)
    db.commit()


def unblock_user(db: Session, blocker_id: int, blocked_id: int) -> None:
    block = _find_block(db, blocker_id, blocked_id)
    if block is None:
        return
    db.delete(block)
    db.commit()


def list_blocked_users(db: Session, blocker_id: int) -> list[BlockedUserPublic]:
    rows = db.execute(
        select(UserBlock, User)
        .join(User, User.id == UserBlock.blocked_id)
        .where(UserBlock.blocker_id == blocker_id)
        .order_by(UserBlock.created_at.desc())
    ).all()
    return [
        BlockedUserPublic(
            user_id=user.id,
            username=user.username,
            profile_picture_url=user.profile_picture_url,
            blocked_at=block.created_at,
        )
        for block, user in rows
    ]


def hidden_user_ids(db: Session, user_id: int) -> set[int]:
    """Users hidden from `user_id` in either direction: blocked by them, or blocking them."""
    rows = db.execute(
        select(UserBlock.blocker_id, UserBlock.blocked_id).where(
            or_(UserBlock.blocker_id == user_id, UserBlock.blocked_id == user_id)
        )
    ).all()
    return {blocked_id if blocker_id == user_id else blocker_id for blocker_id, blocked_id in rows}


def is_blocked_between(db: Session, first_user_id: int, second_user_id: int) -> bool:
    return second_user_id in hidden_user_ids(db, first_user_id)


def _find_block(db: Session, blocker_id: int, blocked_id: int) -> UserBlock | None:
    return db.scalar(
        select(UserBlock).where(UserBlock.blocker_id == blocker_id, UserBlock.blocked_id == blocked_id)
    )


def _sever_social_ties(db: Session, blocker_id: int, blocked_id: int) -> None:
    pair = (blocker_id, blocked_id)
    db.execute(delete(Friendship).where(_either_direction(Friendship.user_id, Friendship.friend_id, *pair)))
    db.execute(
        delete(BuddyRelationship).where(
            _either_direction(BuddyRelationship.requester_id, BuddyRelationship.addressee_id, *pair)
        )
    )
    _cancel_open_duels_between(db, blocker_id, blocked_id)


def _either_direction(left_column, right_column, first_user_id: int, second_user_id: int):
    return or_(
        (left_column == first_user_id) & (right_column == second_user_id),
        (left_column == second_user_id) & (right_column == first_user_id),
    )


def _cancel_open_duels_between(db: Session, blocker_id: int, blocked_id: int) -> None:
    pair = {blocker_id, blocked_id}
    duels = db.scalars(
        select(SocialChallenge).where(
            SocialChallenge.challenge_kind == "duel",
            SocialChallenge.status.in_(("active", "pending")),
            SocialChallenge.owner_id.in_(pair),
        )
    ).all()
    for duel in duels:
        if pair <= _duel_participants(db, duel):
            cancel_challenge(db, duel, actor_user_id=blocker_id)


def _duel_participants(db: Session, duel: SocialChallenge) -> set[int]:
    member_ids = set(
        db.scalars(select(SocialChallengeMember.user_id).where(SocialChallengeMember.challenge_id == duel.id)).all()
    )
    invitee_id = invitee_user_id(load_challenge_meta(duel))
    return {duel.owner_id, *member_ids, *([invitee_id] if invitee_id is not None else [])}
