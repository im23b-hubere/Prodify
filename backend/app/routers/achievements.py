from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.achievementsutil import ACHIEVEMENT_DEFINITIONS
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserAchievement
from app.schemas import AchievementDefPublic, AchievementUnlockedPublic, AchievementsListPublic

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("/list", response_model=AchievementsListPublic)
def list_achievements(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    defs = [
        AchievementDefPublic(id=i, title=t, description=d, emoji=e) for i, t, d, e in ACHIEVEMENT_DEFINITIONS
    ]
    rows = db.scalars(select(UserAchievement).where(UserAchievement.user_id == current.id)).all()
    unlocked = [
        AchievementUnlockedPublic(id=r.achievement_type, unlocked_at=r.unlocked_at)
        for r in rows
    ]
    return AchievementsListPublic(definitions=defs, unlocked=unlocked)


@router.post("/{achievement_id}/unlock", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def unlock_placeholder(achievement_id: str):
    raise HTTPException(
        status_code=501,
        detail="Unlocks are granted automatically when you complete sessions.",
    )
