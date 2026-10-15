"""Behaviour signals the app reports so the engagement engine can learn from them."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, utcnow
from app.services.engagement.deliveries import record_app_open

router = APIRouter(prefix="/engagement", tags=["engagement"])


@router.post("/app-open", status_code=status.HTTP_204_NO_CONTENT)
def report_app_open(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    """Sent when the app comes to the foreground; counted at most once per half hour."""
    record_app_open(db, current.id, utcnow())
    db.commit()
