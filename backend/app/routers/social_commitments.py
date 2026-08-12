from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.dependencies_subscription import user_has_premium_access
from app.models import User
from app.schemas import CommitmentBody, CommitmentPublic
from app.services.commitment_service import (
    TooManyWitnessesError,
    WitnessNotFriendError,
    get_current_commitment,
    list_current_commitments,
    publish_commitment,
)

router = APIRouter()


@router.post("/commitment", response_model=CommitmentPublic)
def set_commitment(
    body: CommitmentBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CommitmentPublic:
    _validate_free_tier(db, current, body)
    try:
        return publish_commitment(db, current, body)
    except TooManyWitnessesError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except WitnessNotFriendError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.get("/commitment", response_model=CommitmentPublic | None)
def get_commitment_status(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    commitment_key: str = "sessions",
) -> CommitmentPublic | None:
    return get_current_commitment(db, current, commitment_key)


@router.get("/commitments", response_model=list[CommitmentPublic])
def list_commitments(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[CommitmentPublic]:
    return list_current_commitments(db, current)


def _validate_free_tier(db: Session, user: User, body: CommitmentBody) -> None:
    if user_has_premium_access(db, user):
        return
    if body.period_days > 7:
        raise HTTPException(status_code=402, detail="Track longer commitment windows with Premium.")
    if body.commitment_key != "sessions":
        raise HTTPException(status_code=402, detail="Track multiple commitments with Premium.")
