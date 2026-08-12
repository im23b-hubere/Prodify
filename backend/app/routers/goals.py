from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import GoalCurrentPublic, GoalSetBody
from app.services.weekly_goal_service import current_weekly_goal, set_weekly_goal as save_weekly_goal

router = APIRouter(prefix="/goals", tags=["goals"])


@router.post("/set", response_model=GoalCurrentPublic)
def set_weekly_goal(
    body: GoalSetBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return save_weekly_goal(db, current.id, body.goal_type, body.target_value)


@router.get("/current", response_model=GoalCurrentPublic)
def current_goal(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return current_weekly_goal(db, current.id)
