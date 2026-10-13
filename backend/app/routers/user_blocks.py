"""Block and unblock other users. Open to every signed-in user: safety is never behind the paywall."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.contracts.social import BlockedUserPublic
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services.user_block_service import (
    BlockOperationError,
    BlockTargetNotFoundError,
    SelfBlockError,
    block_user,
    list_blocked_users,
    unblock_user,
)

router = APIRouter()


@router.get("/me/blocked", response_model=list[BlockedUserPublic])
def list_my_blocked_users(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return list_blocked_users(db, current.id)


@router.post("/{user_id}/block", status_code=status.HTTP_204_NO_CONTENT)
def block(
    user_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    try:
        block_user(db, current.id, user_id)
    except BlockOperationError as error:
        raise _block_http_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{user_id}/block", status_code=status.HTTP_204_NO_CONTENT)
def unblock(
    user_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    unblock_user(db, current.id, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _block_http_error(error: BlockOperationError) -> HTTPException:
    if isinstance(error, SelfBlockError):
        return HTTPException(status_code=400, detail="You cannot block yourself")
    if isinstance(error, BlockTargetNotFoundError):
        return HTTPException(status_code=404, detail="User not found")
    return HTTPException(status_code=400, detail="Block operation failed")
