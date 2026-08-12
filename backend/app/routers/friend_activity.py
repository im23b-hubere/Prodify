"""Shared activity feed endpoint for friends."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import FriendActivityPublic
from app.services.friend_activity_service import build_friend_activity

router = APIRouter()


@router.get("/activity", response_model=list[FriendActivityPublic])
def friends_activity(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 20,
):
    return build_friend_activity(db, current.id, limit)
