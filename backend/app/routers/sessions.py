from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ProductionSession, User, utcnow
from app.timeutil import as_utc_aware
from app.schemas import SessionPublic, SessionStart, SessionStop

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/start", response_model=SessionPublic, status_code=status.HTTP_201_CREATED)
def start_session(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    body: SessionStart | None = None,
):
    active = db.scalar(
        select(ProductionSession).where(
            ProductionSession.user_id == current.id,
            ProductionSession.stopped_at.is_(None),
        )
    )
    if active is not None:
        raise HTTPException(status_code=400, detail="You already have an active session")

    notes = body.notes if body else None
    row = ProductionSession(user_id=current.id, started_at=utcnow(), notes=notes)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/stop", response_model=SessionPublic)
def stop_session(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    body: SessionStop,
):
    row = db.get(ProductionSession, body.session_id)
    if row is None or row.user_id != current.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if row.stopped_at is not None:
        raise HTTPException(status_code=400, detail="Session already stopped")

    end = utcnow()
    delta = end - as_utc_aware(row.started_at)
    row.stopped_at = end
    row.duration_seconds = max(0, int(delta.total_seconds()))
    db.commit()
    db.refresh(row)
    return row


@router.get("/list", response_model=list[SessionPublic])
def list_sessions(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
    offset: int = 0,
):
    if limit > 200:
        limit = 200
    rows = db.scalars(
        select(ProductionSession)
        .where(ProductionSession.user_id == current.id)
        .order_by(ProductionSession.started_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return list(rows)
