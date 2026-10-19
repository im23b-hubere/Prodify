"""XP rank positions for accepted friends (path markers; not the session leaderboard)."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import FriendsProgressionPublic
from app.services.friend_progression_service import build_friends_progression

router = APIRouter()


@router.get("/progression", response_model=FriendsProgressionPublic)
def friends_progression(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> FriendsProgressionPublic:
    return build_friends_progression(db, current.id)
