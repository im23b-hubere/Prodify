from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.contracts.social import (
    BuddyInviteAcceptBody,
    BuddyInviteBody,
    BuddyStatusPublic,
    CheckinLogBody,
    CheckinPlanBody,
    CheckinStatusPublic,
)
from app.services.buddy_service import (
    BuddyFriendshipRequiredError,
    BuddyInviteNotFoundError,
    BuddyOperationError,
    BuddyUnavailableError,
    BuddyUserNotFoundError,
    SelfBuddyInviteError,
    accept_buddy_invite as accept_invite,
    get_buddy_status as build_buddy_status,
    invite_buddy as create_invite,
)
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
    try:
        return create_invite(db, current.id, body.friend_user_id)
    except BuddyOperationError as error:
        raise _buddy_http_error(error) from error


@router.post("/buddy/accept", response_model=BuddyStatusPublic)
def accept_buddy_invite(
    body: BuddyInviteAcceptBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return accept_invite(db, current.id, body.invite_id)
    except BuddyOperationError as error:
        raise _buddy_http_error(error) from error


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


def _buddy_http_error(error: BuddyOperationError) -> HTTPException:
    if isinstance(error, BuddyUserNotFoundError):
        return HTTPException(status_code=404, detail="User not found")
    if isinstance(error, SelfBuddyInviteError):
        return HTTPException(status_code=400, detail="You cannot invite yourself")
    if isinstance(error, BuddyFriendshipRequiredError):
        return HTTPException(status_code=403, detail="Buddy invite requires friendship first")
    if isinstance(error, BuddyUnavailableError):
        return HTTPException(status_code=409, detail="Either you or this friend already has a buddy")
    if isinstance(error, BuddyInviteNotFoundError):
        return HTTPException(status_code=404, detail="Buddy invite not found")
    return HTTPException(status_code=400, detail="Buddy operation failed")
