from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserProgression
from app.schemas import ProgressionLevelPublic, ProgressionPublic
from app.services.progression_service import apply_inactivity_decay, level_catalog, to_progression_public

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
def progression_levels():
    return level_catalog()


@router.post("/sync", response_model=ProgressionPublic)
def progression_sync(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.scalar(select(UserProgression).where(UserProgression.user_id == current.id))
    decayed_row, decayed = apply_inactivity_decay(db, current.id)
    if decayed_row is not None:
        row = decayed_row
    if decayed:
        db.commit()
    return to_progression_public(row)
