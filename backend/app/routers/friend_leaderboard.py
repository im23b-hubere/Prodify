"""Leaderboard endpoint for a user's friend group."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import FriendLeaderboardPublic
from app.services.friend_leaderboard_service import build_friend_leaderboard

router = APIRouter()


@router.get("/leaderboard", response_model=FriendLeaderboardPublic)
def friends_leaderboard(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    period: str = "week",
) -> FriendLeaderboardPublic:
    return build_friend_leaderboard(db, current.id, period)
