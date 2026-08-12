import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts.sessions import SessionUpdate
from app.models import ProductionSession, utcnow
from app.services.friend_graph import friend_user_ids
from app.services.streak_reconcile_service import reconcile_streak_row_for_user


class SessionRecordNotFoundError(LookupError):
    pass


class DeletedSessionEditError(ValueError):
    pass


class ActiveSessionDeleteError(ValueError):
    pass


class SessionNotDeletedError(ValueError):
    pass


class ActiveSessionRestoreConflictError(ValueError):
    def __init__(self, active_session_id: int) -> None:
        super().__init__("Active session already exists")
        self.active_session_id = active_session_id


def list_user_sessions(
    db: Session,
    user_id: int,
    *,
    deleted: bool,
    limit: int,
    offset: int,
) -> list[ProductionSession]:
    deletion_filter = (
        ProductionSession.deleted_at.is_not(None)
        if deleted
        else ProductionSession.deleted_at.is_(None)
    )
    return list(
        db.scalars(
            select(ProductionSession)
            .where(ProductionSession.user_id == user_id, deletion_filter)
            .order_by(ProductionSession.started_at.desc())
            .offset(offset)
            .limit(min(limit, 200))
        ).all()
    )


def get_visible_session(db: Session, session_id: int, viewer_id: int) -> ProductionSession:
    session = db.get(ProductionSession, session_id)
    if session is None or not _can_view_session(db, viewer_id, session):
        raise SessionRecordNotFoundError
    return session


def update_session_record(
    db: Session,
    session_id: int,
    user_id: int,
    request: SessionUpdate,
) -> ProductionSession:
    session = _owned_session(db, session_id, user_id)
    if session.deleted_at is not None:
        raise DeletedSessionEditError
    _apply_updates(session, request.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(session)
    return session


def delete_session_record(db: Session, session_id: int, user_id: int) -> None:
    session = _owned_session(db, session_id, user_id, require_not_deleted=True)
    if session.stopped_at is None:
        raise ActiveSessionDeleteError
    session.deleted_at = utcnow()
    reconcile_streak_row_for_user(db, user_id)
    db.commit()


def restore_session_record(
    db: Session,
    session_id: int,
    user_id: int,
) -> ProductionSession:
    session = _owned_session(db, session_id, user_id)
    if session.deleted_at is None:
        raise SessionNotDeletedError
    if session.stopped_at is None:
        active = _active_session(db, user_id)
        if active is not None and active.id != session.id:
            raise ActiveSessionRestoreConflictError(active.id)
    session.deleted_at = None
    reconcile_streak_row_for_user(db, user_id)
    db.commit()
    db.refresh(session)
    return session


def _owned_session(
    db: Session,
    session_id: int,
    user_id: int,
    *,
    require_not_deleted: bool = False,
) -> ProductionSession:
    session = db.get(ProductionSession, session_id)
    missing = session is None or session.user_id != user_id
    if require_not_deleted and session is not None and session.deleted_at is not None:
        missing = True
    if missing:
        raise SessionRecordNotFoundError
    return session


def _active_session(db: Session, user_id: int) -> ProductionSession | None:
    return db.scalar(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.stopped_at.is_(None),
            ProductionSession.deleted_at.is_(None),
        )
    )


def _can_view_session(db: Session, viewer_id: int, session: ProductionSession) -> bool:
    if session.user_id == viewer_id:
        return True
    if session.deleted_at is not None or session.stopped_at is None:
        return False
    if session.duration_seconds is None:
        return False
    return session.user_id in friend_user_ids(db, viewer_id)


def _apply_updates(session: ProductionSession, updates: dict) -> None:
    if "session_type" in updates and updates["session_type"] is not None:
        session.session_type = updates["session_type"].value
    for field in ("notes", "mood_level"):
        if field in updates:
            setattr(session, field, updates[field])
    if "tags" in updates:
        session.tags = json.dumps(updates["tags"]) if updates["tags"] else None
    if "track_outcome" in updates:
        session.track_outcome = updates["track_outcome"]
        if updates["track_outcome"] != "finished":
            session.track_title = None
    if "track_title" in updates:
        session.track_title = (
            updates["track_title"] if (session.track_outcome or "none") == "finished" else None
        )
