"""Friend request and friendship lifecycle endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import (
    FriendIncomingPublic,
    FriendPostAcceptActionPublic,
    FriendRequestCreate,
    FriendStatusPublic,
    FriendshipPublic,
)
from app.services.friendship_service import (
    AlreadyFriendsError,
    FriendRequestNotFoundError,
    FriendUserNotFoundError,
    FriendshipAccessDeniedError,
    FriendshipNotFoundError,
    FriendshipOperationError,
    IncomingRequestPendingError,
    OutgoingRequestPendingError,
    SelfFriendRequestError,
    accept_friend_request as accept_request,
    delete_friendship as remove_friendship,
    friendship_status as build_friendship_status,
    list_incoming_requests as build_incoming_requests,
    post_accept_actions as build_post_accept_actions,
    send_friend_request as create_friend_request,
)

router = APIRouter()


@router.post("/request", response_model=FriendshipPublic, status_code=status.HTTP_201_CREATED)
def send_friend_request(
    body: FriendRequestCreate,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return create_friend_request(db, current.id, body.username)
    except FriendshipOperationError as error:
        raise _friendship_http_error(error) from error


@router.get("/status/{user_id}", response_model=FriendStatusPublic)
def friendship_status(
    user_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return build_friendship_status(db, current, user_id)
    except FriendshipOperationError as error:
        raise _friendship_http_error(error) from error


@router.get("/incoming", response_model=list[FriendIncomingPublic])
def list_incoming_requests(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return build_incoming_requests(db, current.id)


@router.post("/{friendship_id}/accept", response_model=FriendshipPublic)
def accept_friend_request(
    friendship_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return accept_request(db, current, friendship_id)
    except FriendshipOperationError as error:
        raise _friendship_http_error(error) from error


@router.delete("/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_friendship(
    friendship_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        remove_friendship(db, current.id, friendship_id)
    except FriendshipOperationError as error:
        raise _friendship_http_error(error) from error
    return None


@router.get("/{friendship_id}/post-accept-actions", response_model=list[FriendPostAcceptActionPublic])
def post_accept_actions(
    friendship_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return build_post_accept_actions(db, current.id, friendship_id)
    except FriendshipOperationError as error:
        raise _friendship_http_error(error) from error


def _friendship_http_error(error: FriendshipOperationError) -> HTTPException:
    if isinstance(error, FriendUserNotFoundError):
        return HTTPException(status_code=404, detail="User not found")
    if isinstance(error, SelfFriendRequestError):
        return HTTPException(status_code=400, detail="You cannot add yourself")
    if isinstance(error, AlreadyFriendsError):
        return HTTPException(status_code=400, detail="You are already friends with this user")
    if isinstance(error, OutgoingRequestPendingError):
        return HTTPException(status_code=400, detail="Friend request already pending")
    if isinstance(error, IncomingRequestPendingError):
        return HTTPException(
            status_code=400,
            detail="This user already sent you a request — open incoming requests to accept it.",
        )
    if isinstance(error, FriendRequestNotFoundError):
        return HTTPException(status_code=404, detail="Friend request not found")
    if isinstance(error, FriendshipNotFoundError):
        return HTTPException(status_code=404, detail="Friendship not found")
    if isinstance(error, FriendshipAccessDeniedError):
        return HTTPException(status_code=403, detail="Not allowed")
    return HTTPException(status_code=400, detail="Friendship operation failed")
