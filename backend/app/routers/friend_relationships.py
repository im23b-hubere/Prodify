"""Friend request and friendship lifecycle endpoints."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Friendship, FriendshipStatus, User
from app.schemas import (
    FriendIncomingPublic,
    FriendPostAcceptActionPublic,
    FriendRequestCreate,
    FriendStatusPublic,
    FriendshipPublic,
)
from app.services.kpi_tracker import track_event
from app.services.progression_service import grant_xp

router = APIRouter()


def _friendship_between(db: Session, first_user_id: int, second_user_id: int) -> Friendship | None:
    return db.scalar(
        select(Friendship).where(
            or_(
                (Friendship.user_id == first_user_id) & (Friendship.friend_id == second_user_id),
                (Friendship.user_id == second_user_id) & (Friendship.friend_id == first_user_id),
            )
        )
    )


@router.post("/request", response_model=FriendshipPublic, status_code=status.HTTP_201_CREATED)
def send_friend_request(
    body: FriendRequestCreate,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    uname = body.username.strip().lower()
    target = db.scalar(select(User).where(func.lower(User.username) == uname))
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current.id:
        raise HTTPException(status_code=400, detail="You cannot add yourself")

    existing = _friendship_between(db, current.id, target.id)
    if existing is not None:
        if existing.status == FriendshipStatus.accepted:
            raise HTTPException(status_code=400, detail="You are already friends with this user")
        if existing.user_id == current.id:
            raise HTTPException(status_code=400, detail="Friend request already pending")
        raise HTTPException(
            status_code=400,
            detail="This user already sent you a request — open incoming requests to accept it.",
        )

    row = Friendship(user_id=current.id, friend_id=target.id, status=FriendshipStatus.pending)
    db.add(row)
    db.commit()
    db.refresh(row)
    track_event(db, "invite_sent", current.id, {"friend_id": target.id})
    db.commit()
    return row


@router.get("/status/{user_id}", response_model=FriendStatusPublic)
def friendship_status(
    user_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if user_id == current.id:
        return FriendStatusPublic(status="self", username=current.username)
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    uname = target.username
    row = _friendship_between(db, current.id, user_id)
    if row is None:
        return FriendStatusPublic(status="none", username=uname)
    if row.status == FriendshipStatus.accepted:
        return FriendStatusPublic(status="accepted", username=uname)
    direction: Literal["outgoing", "incoming"] = (
        "outgoing" if row.user_id == current.id else "incoming"
    )
    return FriendStatusPublic(status="pending", username=uname, pending_direction=direction)


@router.get("/incoming", response_model=list[FriendIncomingPublic])
def list_incoming_requests(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    rows = db.scalars(
        select(Friendship)
        .where(
            Friendship.friend_id == current.id,
            Friendship.status == FriendshipStatus.pending,
        )
        .order_by(Friendship.created_at.desc())
    ).all()
    out: list[FriendIncomingPublic] = []
    for f in rows:
        u = db.get(User, f.user_id)
        if u is None:
            continue
        out.append(
            FriendIncomingPublic(
                id=f.id,
                user_id=f.user_id,
                username=u.username,
                created_at=f.created_at,
            )
        )
    return out


@router.post("/{friendship_id}/accept", response_model=FriendshipPublic)
def accept_friend_request(
    friendship_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(Friendship, friendship_id)
    if row is None or row.friend_id != current.id or row.status != FriendshipStatus.pending:
        raise HTTPException(status_code=404, detail="Friend request not found")
    row.status = FriendshipStatus.accepted
    requester = db.get(User, row.user_id)
    if requester is not None:
        requester.bonus_rescues = int(requester.bonus_rescues or 0) + 1
        requester.bonus_challenge_slots = int(requester.bonus_challenge_slots or 0) + 1
    current.bonus_rescues = int(current.bonus_rescues or 0) + 1
    current.bonus_challenge_slots = int(current.bonus_challenge_slots or 0) + 1
    grant_xp(
        db,
        current.id,
        10,
        source_type="friend_request_accept",
        source_id=str(row.id),
        meta={"friend_user_id": row.user_id},
    )
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_friendship(
    friendship_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(Friendship, friendship_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Friendship not found")
    if row.user_id != current.id and row.friend_id != current.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    db.delete(row)
    db.commit()
    return None


@router.get("/{friendship_id}/post-accept-actions", response_model=list[FriendPostAcceptActionPublic])
def post_accept_actions(
    friendship_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(Friendship, friendship_id)
    if row is None or row.status != FriendshipStatus.accepted:
        raise HTTPException(status_code=404, detail="Friendship not found")
    if row.user_id != current.id and row.friend_id != current.id:
        raise HTTPException(status_code=403, detail="Not allowed")
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
