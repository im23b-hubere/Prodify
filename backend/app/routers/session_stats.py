from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import SessionStatsPublic
from app.services.session_analytics_service import build_session_stats

router = APIRouter()


@router.get("/stats", response_model=SessionStatsPublic)
def sessions_stats(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    period: str = "week",
) -> SessionStatsPublic:
    return build_session_stats(db, current.id, period)
