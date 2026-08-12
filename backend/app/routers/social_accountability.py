from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import BuddyRelationship, BuddyStatus, Friendship, FriendshipStatus, User, utcnow
from app.schemas import (
    BuddyInviteAcceptBody,
    BuddyInviteBody,
    BuddyStatusPublic,
    CheckinLogBody,
    CheckinPlanBody,
    CheckinStatusPublic,
)
from app.services.buddy_service import current_buddy_relationship, get_buddy_status as build_buddy_status
from app.services.checkin_service import complete_today, get_status, update_weekly_plan


router = APIRouter()


@router.get("/buddy", response_model=BuddyStatusPublic)
def get_buddy_status(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return build_buddy_status(db, current.id)


@router.post("/buddy/invite", response_model=BuddyStatusPublic)
def invite_buddy(
    body: BuddyInviteBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    invitee = db.get(User, body.friend_user_id)
    if invitee is None:
        raise HTTPException(status_code=404, detail="User not found")
    if invitee.id == current.id:
        raise HTTPException(status_code=400, detail="You cannot invite yourself")
    if not _are_friends(db, current.id, invitee.id):
        raise HTTPException(status_code=403, detail="Buddy invite requires friendship first")
    if current_buddy_relationship(db, current.id) or current_buddy_relationship(db, invitee.id):
        raise HTTPException(status_code=409, detail="Either you or this friend already has a buddy")

    relationship = BuddyRelationship(
        requester_id=current.id,
        addressee_id=invitee.id,
        status=BuddyStatus.pending,
    )
    db.add(relationship)
    db.commit()
    db.refresh(relationship)
    return build_buddy_status(db, current.id)


@router.post("/buddy/accept", response_model=BuddyStatusPublic)
def accept_buddy_invite(
    body: BuddyInviteAcceptBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    relationship = db.get(BuddyRelationship, body.invite_id)
    if (
        relationship is None
        or relationship.addressee_id != current.id
        or relationship.status != BuddyStatus.pending
    ):
        raise HTTPException(status_code=404, detail="Buddy invite not found")
    relationship.status = BuddyStatus.active
    relationship.activated_at = utcnow()
    db.commit()
    return build_buddy_status(db, current.id)


@router.post("/checkins/plan", response_model=CheckinStatusPublic)
def set_checkin_plan(
    body: CheckinPlanBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return update_weekly_plan(db, current.id, body.target_checkins)


@router.post("/checkins/done", response_model=CheckinStatusPublic)
def mark_checkin_done(
    body: CheckinLogBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return complete_today(db, current, body.note)


@router.get("/checkins/status", response_model=CheckinStatusPublic)
def get_checkin_status(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return get_status(db, current.id)


def _are_friends(db: Session, first_user_id: int, second_user_id: int) -> bool:
    friendship = db.scalar(
        select(Friendship).where(
            Friendship.status == FriendshipStatus.accepted,
            or_(
                (Friendship.user_id == first_user_id) & (Friendship.friend_id == second_user_id),
                (Friendship.user_id == second_user_id) & (Friendship.friend_id == first_user_id),
            ),
        )
    )
    return friendship is not None
