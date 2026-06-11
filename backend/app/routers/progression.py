from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserProgression
from app.schemas import ProgressionLevelPublic, ProgressionPublic
from app.services.progression_service import (
    XP_LEVEL_CATALOG_MAX,
    level_catalog,
    sync_user_progression,
    to_progression_public,
)

router = APIRouter(prefix="/progression", tags=["progression"])


@router.get("/me", response_model=ProgressionPublic)
def progression_me(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.scalar(select(UserProgression).where(UserProgression.user_id == current.id))
    return to_progression_public(row)


@router.get("/unlocks", response_model=list[str])
def progression_unlocks(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.scalar(select(UserProgression).where(UserProgression.user_id == current.id))
    level = int(row.current_level) if row else 1
    unlocks: list[str] = []
    if level >= 3:
        unlocks.append("theme_obsidian")
    if level >= 5:
        unlocks.append("template_fast_start")
    if level >= 8:
        unlocks.append("feature_producer_vault_preview")
    return unlocks


@router.get("/levels", response_model=list[ProgressionLevelPublic])
def progression_levels(
    max_level: Annotated[int | None, Query(description="Last level row (>= default catalog).", ge=1, le=200)] = None,
):
    top = XP_LEVEL_CATALOG_MAX if max_level is None else int(max_level)
    top = max(XP_LEVEL_CATALOG_MAX, min(200, top))
    return level_catalog(top)


@router.post("/sync", response_model=ProgressionPublic)
def progression_sync(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = sync_user_progression(db, current.id)
    db.commit()
    return to_progression_public(row)
