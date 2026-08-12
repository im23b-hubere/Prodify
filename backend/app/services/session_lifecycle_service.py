from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.achievementsutil import compute_focus_score_for_session, grant_achievements_after_completed_session
from app.models import CheckinLog, ProductionSession, Streak, utcnow
from app.services.kpi_tracker import track_event
from app.services.progression_service import grant_xp, xp_for_completed_session
from app.services.social_challenge_service import sync_challenge_progress_on_session_complete
from app.services.streak_reconcile_service import reconcile_streak_row_for_user
from app.timeutil import as_utc_aware


@dataclass(frozen=True)
class SessionCompletion:
    session: ProductionSession
    previous_streak: int
    current_streak: int


class ActiveSessionExistsError(Exception):
    def __init__(self, session_id: int | None) -> None:
        super().__init__("Active session already exists")
        self.session_id = session_id


def find_active_session(db: Session, user_id: int) -> ProductionSession | None:
    return db.scalar(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.stopped_at.is_(None),
            ProductionSession.deleted_at.is_(None),
        )
    )


def create_session(
    db: Session,
    user_id: int,
    session_type: str,
    *,
    notes: str | None = None,
    mood_level: int | None = None,
    tags: list[str] | None = None,
) -> ProductionSession:
    session = ProductionSession(
        user_id=user_id,
        started_at=utcnow(),
        notes=notes,
        session_type=session_type,
        mood_level=mood_level,
        tags=json.dumps(tags) if tags else None,
        paused_duration_seconds=0,
    )
    db.add(session)
    db.flush()
    track_event(
        db,
        "session_started",
        user_id,
        {"session_id": session.id, "session_type": session.session_type},
    )
    db.commit()
    db.refresh(session)
    return session


def create_unique_active_session(
    db: Session,
    user_id: int,
    session_type: str,
    **session_details,
) -> ProductionSession:
    active = find_active_session(db, user_id)
    if active is not None:
        raise ActiveSessionExistsError(active.id)
    try:
        return create_session(db, user_id, session_type, **session_details)
    except IntegrityError as error:
        db.rollback()
        concurrent_session = find_active_session(db, user_id)
        raise ActiveSessionExistsError(
            concurrent_session.id if concurrent_session else None
        ) from error


def complete_session(
    db: Session,
    user_id: int,
    session: ProductionSession,
) -> SessionCompletion:
    stopped_at = utcnow()
    _finish_timing(session, stopped_at)
    _mark_auto_checkin_done(db, user_id)
    db.flush()
    xp_delta = _grant_session_xp(db, user_id, session)
    track_event(
        db,
        "session_completed",
        user_id,
        {
            "session_id": session.id,
            "duration_seconds": int(session.duration_seconds or 0),
            "xp_delta": xp_delta,
        },
    )
    streak = db.scalar(select(Streak).where(Streak.user_id == user_id))
    grant_achievements_after_completed_session(db, user_id, session, streak)
    _, previous_streak, current_streak, _, _ = reconcile_streak_row_for_user(db, user_id)
    sync_challenge_progress_on_session_complete(
        db,
        user_id=user_id,
        session_id=session.id,
        stopped_at=stopped_at,
        duration_seconds=int(session.duration_seconds or 0),
    )
    db.commit()
    db.refresh(session)
    return SessionCompletion(session, previous_streak, current_streak)


def pause_active_session(db: Session, session: ProductionSession) -> ProductionSession:
    session.pause_started_at = utcnow()
    db.commit()
    db.refresh(session)
    return session


def resume_active_session(db: Session, session: ProductionSession) -> ProductionSession:
    _accumulate_pause(session, utcnow())
    db.commit()
    db.refresh(session)
    return session


def _finish_timing(session: ProductionSession, stopped_at: datetime) -> None:
    _accumulate_pause(session, stopped_at)
    gross_seconds = int((stopped_at - as_utc_aware(session.started_at)).total_seconds())
    session.stopped_at = stopped_at
    session.duration_seconds = max(0, gross_seconds - int(session.paused_duration_seconds or 0))
    session.focus_score = compute_focus_score_for_session(session)


def _accumulate_pause(session: ProductionSession, ended_at: datetime) -> None:
    if session.pause_started_at is None:
        return
    pause_seconds = int((ended_at - as_utc_aware(session.pause_started_at)).total_seconds())
    if pause_seconds > 0:
        session.paused_duration_seconds = int(session.paused_duration_seconds or 0) + pause_seconds
    session.pause_started_at = None


def _grant_session_xp(db: Session, user_id: int, session: ProductionSession) -> int:
    duration = int(session.duration_seconds or 0)
    xp_delta = xp_for_completed_session(duration)
    grant_xp(
        db,
        user_id,
        xp_delta,
        source_type="session_complete",
        source_id=str(session.id),
        meta={"duration_seconds": duration, "focus_score": int(session.focus_score or 0)},
    )
    return xp_delta


def _mark_auto_checkin_done(db: Session, user_id: int) -> None:
    day_key = utcnow().date().isoformat()
    checkin = db.scalar(
        select(CheckinLog).where(CheckinLog.user_id == user_id, CheckinLog.day_key == day_key)
    )
    if checkin is None:
        db.add(CheckinLog(user_id=user_id, day_key=day_key, state="done", note="Auto session activity"))
        return
    checkin.state = "done"
    if not checkin.note:
        checkin.note = "Auto session activity"
