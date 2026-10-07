import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts.sessions import SessionUpdate
from app.models import ProductionSession, utcnow
from app.services.friend_graph import friend_user_ids
from app.services.kpi_tracker import track_event_deduped
from app.services.session_skill_focus_service import (
    drop_area_weights_unless_production,
    drop_incompatible_skill_focuses,
    replace_area_weights,
    replace_focus_times,
    replace_skill_focuses,
    set_primary_skill_focus,
)
from app.services.social_challenge_events import IGNORED_CHALLENGE_EVENTS, ChallengeEvents
from app.services.social_challenge_service import (
    revoke_session_challenge_credit,
    sync_challenge_progress_on_session_complete,
)
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


def get_owned_session(db: Session, session_id: int, user_id: int) -> ProductionSession:
    return _owned_session(db, session_id, user_id, require_not_deleted=True)


def update_session_record(
    db: Session,
    session_id: int,
    user_id: int,
    request: SessionUpdate,
) -> ProductionSession:
    session = _owned_session(db, session_id, user_id)
    if session.deleted_at is not None:
        raise DeletedSessionEditError
    focuses_before = _focus_snapshot(session)
    _apply_updates(session, request.model_dump(exclude_unset=True))
    if session.stopped_at is not None and _focus_snapshot(session) != focuses_before:
        _track_focus_reflection(db, session, had_planned_focus=bool(focuses_before[0]))
    db.commit()
    db.refresh(session)
    return session


def delete_session_record(db: Session, session_id: int, user_id: int) -> None:
    session = _owned_session(db, session_id, user_id, require_not_deleted=True)
    if session.stopped_at is None:
        raise ActiveSessionDeleteError
    session.deleted_at = utcnow()
    reconcile_streak_row_for_user(db, user_id)
    revoke_session_challenge_credit(db, user_id=user_id, session_id=session.id)
    db.commit()


def restore_session_record(
    db: Session,
    session_id: int,
    user_id: int,
    events: ChallengeEvents = IGNORED_CHALLENGE_EVENTS,
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
    finished_challenge_ids = _recredit_restored_session(db, session)
    db.commit()
    for challenge_id in finished_challenge_ids:
        events.challenge_finished(challenge_id)
    db.refresh(session)
    return session


def _recredit_restored_session(db: Session, session: ProductionSession) -> list[int]:
    if session.stopped_at is None:
        return []
    return sync_challenge_progress_on_session_complete(
        db,
        user_id=session.user_id,
        session_id=session.id,
        stopped_at=session.stopped_at,
        duration_seconds=int(session.duration_seconds or 0),
    )


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


def _focus_snapshot(
    session: ProductionSession,
) -> tuple[frozenset[str], str | None, dict[str, int]]:
    return frozenset(session.skill_focus_ids), session.primary_skill_focus_id, session.weight_by_area


def _track_focus_reflection(
    db: Session, session: ProductionSession, *, had_planned_focus: bool
) -> None:
    """Counts each session once, so the event measures how many sessions get reflected."""
    track_event_deduped(
        db,
        user_id=session.user_id,
        bucket_key=f"session_focus_reflected:{session.id}",
        event_name="session_focus_reflected",
        props={
            "session_id": session.id,
            "session_type": session.session_type,
            "focus_count": len(session.skill_focus_ids),
            "has_main_focus": session.primary_skill_focus_id is not None,
            "area_count": len(session.area_weights),
            "had_planned_focus": had_planned_focus,
        },
    )


def _requested_primary(
    session: ProductionSession, updates: dict, focus_ids: list[str]
) -> str | None:
    """An omitted main focus stays as long as it is still one of the session's focuses."""
    if "primary_skill_focus_id" in updates:
        return updates["primary_skill_focus_id"]
    current = session.primary_skill_focus_id
    return current if current in focus_ids else None


def _apply_updates(session: ProductionSession, updates: dict) -> None:
    if "session_type" in updates and updates["session_type"] is not None:
        session.session_type = updates["session_type"].value
    if "skill_focus_ids" in updates:
        focus_ids = updates["skill_focus_ids"] or []
        replace_skill_focuses(session, focus_ids, _requested_primary(session, updates, focus_ids))
    else:
        drop_incompatible_skill_focuses(session)
        if "primary_skill_focus_id" in updates:
            set_primary_skill_focus(session, updates["primary_skill_focus_id"])
    if "focus_times" in updates:
        replace_focus_times(session, updates["focus_times"] or [])
        if not session.focus_times and "primary_skill_focus_id" not in updates:
            set_primary_skill_focus(session, None)
    if "area_weights" in updates:
        weights = updates["area_weights"] or []
        replace_area_weights(session, {item["branch"]: item["weight"] for item in weights})
    else:
        drop_area_weights_unless_production(session)
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
