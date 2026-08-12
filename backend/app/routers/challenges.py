from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.contracts.social import (
    ChallengeJoinBody,
    ChallengeLeaderboardPublic,
    PublicGoalBody,
    PublicGoalPublic,
    WeeklyCheckinBody,
    WeeklyCheckinPublic,
)
from app.services.weekly_challenge_service import (
    ActiveWeeklyChallengeNotFoundError,
    ChallengeNotFoundError,
    join_weekly_challenge as join_challenge,
    set_public_goal as save_public_goal,
    submit_weekly_checkin,
    weekly_leaderboard as build_weekly_leaderboard,
)

router = APIRouter(prefix="/challenges", tags=["challenges"])


@router.post("/public-goal", response_model=PublicGoalPublic)
def set_public_goal(
    body: PublicGoalBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return save_public_goal(db, current.id, body.target_sessions, body.is_public)


@router.post("/checkin", response_model=WeeklyCheckinPublic)
def did_you_ship_checkin(
    body: WeeklyCheckinBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return submit_weekly_checkin(
        db,
        current.id,
        body.did_ship,
        body.shipped_note,
    )


@router.post("/join", response_model=ChallengeLeaderboardPublic)
def join_weekly_challenge(
    body: ChallengeJoinBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return join_challenge(db, current.id, body.challenge_id)
    except ChallengeNotFoundError as error:
        raise HTTPException(status_code=404, detail="Challenge not found")
    except ActiveWeeklyChallengeNotFoundError as error:
        raise HTTPException(status_code=404, detail="No active weekly challenge") from error


@router.get("/weekly/leaderboard", response_model=ChallengeLeaderboardPublic)
def weekly_leaderboard(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return build_weekly_leaderboard(db)
    except ActiveWeeklyChallengeNotFoundError as error:
        raise HTTPException(status_code=404, detail="No active weekly challenge")
