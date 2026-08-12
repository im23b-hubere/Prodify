import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ProductionSession, User, utcnow
from app.contracts.sessions import SessionPublic, SessionUpdate
from app.services.friend_graph import friend_user_ids
from app.services.streak_reconcile_service import reconcile_streak_row_for_user

router = APIRouter()


def _can_view_session(db: Session, viewer_id: int, row: ProductionSession) -> bool:
    if row.user_id == viewer_id:
        return True
    if row.deleted_at is not None:
        return False
    if row.stopped_at is None or row.duration_seconds is None:
        return False
    return row.user_id in friend_user_ids(db, viewer_id)


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
        .where(ProductionSession.user_id == current.id, ProductionSession.deleted_at.is_(None))
        .order_by(ProductionSession.started_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return list(rows)


@router.get("/trash", response_model=list[SessionPublic])
def list_deleted_sessions(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
    offset: int = 0,
):
    if limit > 200:
        limit = 200
    rows = db.scalars(
        select(ProductionSession)
        .where(ProductionSession.user_id == current.id, ProductionSession.deleted_at.is_not(None))
        .order_by(ProductionSession.started_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return list(rows)


@router.get("/item/{session_id}", response_model=SessionPublic)
def get_session(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(ProductionSession, session_id)
    if row is None or not _can_view_session(db, current.id, row):
        raise HTTPException(status_code=404, detail="Session not found")
    return row


@router.patch("/item/{session_id}", response_model=SessionPublic)
def update_session(
    session_id: int,
    body: SessionUpdate,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(ProductionSession, session_id)
    if row is None or row.user_id != current.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if row.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Deleted sessions cannot be edited")

    updates = body.model_dump(exclude_unset=True)
    if "session_type" in updates and updates["session_type"] is not None:
        row.session_type = updates["session_type"].value
    if "notes" in updates:
        row.notes = updates["notes"]
    if "mood_level" in updates:
        row.mood_level = updates["mood_level"]
    if "tags" in updates:
        row.tags = json.dumps(updates["tags"]) if updates["tags"] else None
    if "track_outcome" in updates:
        row.track_outcome = updates["track_outcome"]
        if updates["track_outcome"] != "finished":
            row.track_title = None
    if "track_title" in updates:
        effective_outcome = row.track_outcome or "none"
        row.track_title = updates["track_title"] if effective_outcome == "finished" else None

    db.commit()
    db.refresh(row)
    return row


@router.delete("/item/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(ProductionSession, session_id)
    if row is None or row.user_id != current.id or row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Session not found")
    if row.stopped_at is None:
        raise HTTPException(status_code=409, detail="Active sessions cannot be deleted")
    row.deleted_at = utcnow()
    reconcile_streak_row_for_user(db, current.id)
    db.commit()
    return None


@router.post("/item/{session_id}/restore", response_model=SessionPublic)
def restore_session(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(ProductionSession, session_id)
    if row is None or row.user_id != current.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if row.deleted_at is None:
        raise HTTPException(status_code=400, detail="Session is not deleted")
    if row.stopped_at is None:
        active = db.scalar(
            select(ProductionSession).where(
                ProductionSession.user_id == current.id,
                ProductionSession.stopped_at.is_(None),
                ProductionSession.deleted_at.is_(None),
            )
        )
        if active is not None and active.id != row.id:
            raise HTTPException(
                status_code=409,
                detail={"message": "Active session already exists", "session_id": active.id},
            )
    row.deleted_at = None
    reconcile_streak_row_for_user(db, current.id)
    db.commit()
    db.refresh(row)
    return row
