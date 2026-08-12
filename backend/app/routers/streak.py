from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.contracts.insights import (
    StreakFreezeResult,
    StreakMilestonesPublic,
    StreakOverviewPublic,
    StreakRunPublic,
)
from app.services.streak_application_service import (
    FreezeAlreadyUsedError,
    NoFreezesRemainingError,
    SessionAlreadyCompletedError,
    StreakFreezeError,
    StreakNotStartedError,
    build_streak_history,
    build_streak_milestones,
    build_streak_overview,
    reconcile_streak,
    use_streak_freeze as activate_streak_freeze,
)

router = APIRouter(prefix="/streak", tags=["streak"])

@router.post("/reconcile", status_code=status.HTTP_204_NO_CONTENT)
def streak_reconcile(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Recompute persisted streak fields and emit streak-break side effects when appropriate.
    Call from the client after meaningful state changes (e.g. app foreground) — not from GET /overview.
    """
    reconcile_streak(db, current.id)
    return None


@router.get("/overview", response_model=StreakOverviewPublic)
def streak_overview(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return build_streak_overview(db, current.id)


@router.get("/history", response_model=list[StreakRunPublic])
def streak_history(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 40,
):
    return build_streak_history(db, current.id, limit)


@router.get("/milestones", response_model=StreakMilestonesPublic)
def streak_milestones(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return build_streak_milestones(db, current.id)


@router.post("/freeze", response_model=StreakFreezeResult)
def use_streak_freeze(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return activate_streak_freeze(db, current)
    except StreakFreezeError as error:
        raise _freeze_http_error(error) from error


def _freeze_http_error(error: StreakFreezeError) -> HTTPException:
    if isinstance(error, SessionAlreadyCompletedError):
        detail = "You already completed a session today."
    elif isinstance(error, FreezeAlreadyUsedError):
        detail = "Streak freeze already used for today."
    elif isinstance(error, NoFreezesRemainingError):
        detail = "No streak freezes left this month."
    elif isinstance(error, StreakNotStartedError):
        detail = "Start a streak before using a freeze."
    else:
        detail = "Unable to use streak freeze."
    return HTTPException(status_code=400, detail=detail)
