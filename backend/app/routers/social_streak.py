from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.contracts.social import BuddyRiskPublic, StreakRescueBody
from app.services.social_streak_service import (
    ActiveBuddyRequiredError,
    BuddyAlreadyRescuedError,
    BuddyRescueTargetError,
    BuddyStreakNotFoundError,
    EncouragementFriendRequiredError,
    EncouragementUserNotFoundError,
    SelfEncouragementError,
    SocialStreakError,
    WeeklyRescueLimitError,
    encourage_streak_restart as send_encouragement,
    get_buddy_risk as build_buddy_risk,
    rescue_buddy_streak,
)


router = APIRouter()


@router.post("/streak/rescue", response_model=dict[str, str | int])
def rescue_streak(
    body: StreakRescueBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return rescue_buddy_streak(db, current, body.rescued_user_id)
    except SocialStreakError as error:
        raise _social_streak_http_error(error) from error


@router.post("/streak/encourage", response_model=dict[str, str | int])
def encourage_streak_restart(
    body: StreakRescueBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return send_encouragement(db, current, body.rescued_user_id)
    except SocialStreakError as error:
        raise _social_streak_http_error(error) from error


@router.get("/buddy/risk", response_model=BuddyRiskPublic)
def get_buddy_risk(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return build_buddy_risk(db, current)


def _social_streak_http_error(error: SocialStreakError) -> HTTPException:
    if isinstance(error, ActiveBuddyRequiredError):
        return HTTPException(status_code=403, detail="Only active buddies can rescue streaks")
    if isinstance(error, BuddyRescueTargetError):
        return HTTPException(status_code=403, detail="You can only rescue your buddy")
    if isinstance(error, BuddyAlreadyRescuedError):
        return HTTPException(status_code=400, detail="Buddy streak already rescued today")
    if isinstance(error, WeeklyRescueLimitError):
        return HTTPException(
            status_code=402,
            detail="Keep your creative run alive with Premium to unlock more saves.",
        )
    if isinstance(error, BuddyStreakNotFoundError):
        return HTTPException(status_code=404, detail="Buddy streak not found")
    if isinstance(error, EncouragementUserNotFoundError):
        return HTTPException(status_code=404, detail="User not found")
    if isinstance(error, SelfEncouragementError):
        return HTTPException(status_code=400, detail="Cannot encourage yourself")
    if isinstance(error, EncouragementFriendRequiredError):
        return HTTPException(status_code=403, detail="You can only encourage friends")
    return HTTPException(status_code=400, detail="Social streak operation failed")
