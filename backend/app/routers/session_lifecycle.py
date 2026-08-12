import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import ProductionSession, User
from app.schemas import SessionPublic, SessionQuickStart, SessionStart, SessionStop
from app.services.push_dispatch import schedule_notify_session_complete
from app.services.session_lifecycle_service import (
    complete_session,
    create_session,
    find_active_session,
    pause_active_session,
    resume_active_session,
)
from app.services.social_consequence import maybe_notify_streak_break_on_transition

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/start", response_model=SessionPublic, status_code=status.HTTP_201_CREATED)
def start_session(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    body: SessionStart,
) -> ProductionSession:
    _ensure_no_active_session(db, current.id)
    try:
        session = create_session(
            db,
            current.id,
            body.session_type.value,
            notes=body.notes,
            mood_level=body.mood_level,
            tags=body.tags,
        )
    except IntegrityError:
        _raise_concurrent_session_conflict(db, current.id)
    logger.info("session_started user_id=%s session_id=%s", current.id, session.id)
    return session


@router.get("/active", response_model=SessionPublic)
def get_active_session(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ProductionSession:
    session = find_active_session(db, current.id)
    if session is None:
        raise HTTPException(status_code=404, detail="No active session")
    return session


@router.post("/stop", response_model=SessionPublic)
def stop_session(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    body: SessionStop,
) -> ProductionSession:
    session = _owned_session(db, current.id, body.session_id)
    if session.stopped_at is not None:
        raise HTTPException(status_code=400, detail="Session already stopped")
    completion = complete_session(db, current.id, session)
    maybe_notify_streak_break_on_transition(
        completion.previous_streak,
        completion.current_streak,
        current.id,
    )
    _schedule_completion_push(current.id, completion.session)
    logger.info(
        "session_stopped user_id=%s session_id=%s duration_s=%s",
        current.id,
        session.id,
        session.duration_seconds,
    )
    return completion.session


@router.post("/item/{session_id}/pause", response_model=SessionPublic)
def pause_session(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ProductionSession:
    session = _active_owned_session(db, current.id, session_id)
    if session.pause_started_at is not None:
        raise HTTPException(status_code=400, detail="Session is already paused")
    return pause_active_session(db, session)


@router.post("/item/{session_id}/resume", response_model=SessionPublic)
def resume_session(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ProductionSession:
    session = _active_owned_session(db, current.id, session_id)
    if session.pause_started_at is None:
        raise HTTPException(status_code=400, detail="Session is not paused")
    return resume_active_session(db, session)


@router.post("/quick-start", response_model=SessionPublic, status_code=status.HTTP_201_CREATED)
def quick_start_session(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    body: SessionQuickStart = SessionQuickStart(),
) -> ProductionSession:
    _ensure_no_active_session(db, current.id)
    try:
        return create_session(db, current.id, body.session_type.value)
    except IntegrityError:
        _raise_concurrent_session_conflict(db, current.id)


def _owned_session(db: Session, user_id: int, session_id: int) -> ProductionSession:
    session = db.get(ProductionSession, session_id)
    if session is None or session.user_id != user_id or session.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _active_owned_session(db: Session, user_id: int, session_id: int) -> ProductionSession:
    session = _owned_session(db, user_id, session_id)
    if session.stopped_at is not None:
        raise HTTPException(status_code=400, detail="Session already stopped")
    return session


def _ensure_no_active_session(db: Session, user_id: int) -> None:
    active = find_active_session(db, user_id)
    if active is not None:
        _raise_active_conflict(active.id)


def _raise_concurrent_session_conflict(db: Session, user_id: int) -> None:
    db.rollback()
    active = find_active_session(db, user_id)
    _raise_active_conflict(active.id if active else None)


def _raise_active_conflict(session_id: int | None) -> None:
    raise HTTPException(
        status_code=409,
        detail={"message": "Active session already exists", "session_id": session_id},
    )


def _schedule_completion_push(user_id: int, session: ProductionSession) -> None:
    try:
        schedule_notify_session_complete(
            settings,
            user_id,
            str(session.session_type),
            int(session.duration_seconds or 0),
        )
    except Exception:
        logger.exception("schedule session-complete push failed")
