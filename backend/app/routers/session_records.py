from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.contracts.sessions import SessionPublic, SessionUpdate
from app.services.session_record_service import (
    ActiveSessionDeleteError,
    ActiveSessionRestoreConflictError,
    DeletedSessionEditError,
    SessionNotDeletedError,
    SessionRecordNotFoundError,
    delete_session_record,
    get_visible_session,
    list_user_sessions,
    restore_session_record,
    update_session_record,
)

router = APIRouter()


@router.get("/list", response_model=list[SessionPublic])
def list_sessions(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
    offset: int = 0,
):
    return list_user_sessions(db, current.id, deleted=False, limit=limit, offset=offset)


@router.get("/trash", response_model=list[SessionPublic])
def list_deleted_sessions(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
    offset: int = 0,
):
    return list_user_sessions(db, current.id, deleted=True, limit=limit, offset=offset)


@router.get("/item/{session_id}", response_model=SessionPublic)
def get_session(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return get_visible_session(db, session_id, current.id)
    except SessionRecordNotFoundError as error:
        raise HTTPException(status_code=404, detail="Session not found")


@router.patch("/item/{session_id}", response_model=SessionPublic)
def update_session(
    session_id: int,
    body: SessionUpdate,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return update_session_record(db, session_id, current.id, body)
    except SessionRecordNotFoundError as error:
        raise HTTPException(status_code=404, detail="Session not found")
    except DeletedSessionEditError as error:
        raise HTTPException(status_code=400, detail="Deleted sessions cannot be edited")


@router.delete("/item/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        delete_session_record(db, session_id, current.id)
    except SessionRecordNotFoundError as error:
        raise HTTPException(status_code=404, detail="Session not found")
    except ActiveSessionDeleteError as error:
        raise HTTPException(status_code=409, detail="Active sessions cannot be deleted")
    return None


@router.post("/item/{session_id}/restore", response_model=SessionPublic)
def restore_session(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return restore_session_record(db, session_id, current.id)
    except SessionRecordNotFoundError as error:
        raise HTTPException(status_code=404, detail="Session not found")
    except SessionNotDeletedError as error:
        raise HTTPException(status_code=400, detail="Session is not deleted")
    except ActiveSessionRestoreConflictError as error:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Active session already exists",
                "session_id": error.active_session_id,
            },
        ) from error
