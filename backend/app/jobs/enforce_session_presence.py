"""Nudge still-running sessions at 3h and safety-stop them at 8h."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.config import Settings
from app.models import ProductionSession, utcnow
from app.services import push_templates
from app.services.push_dispatch import dispatch_to_user
from app.services.push_links import push_data_dashboard
from app.services.session_lifecycle_service import complete_session
from app.services.session_presence import decide_session_presence, effective_elapsed_seconds, stop_deadline
from app.services.social_challenge_notifications import PushChallengeEvents
from app.services.social_consequence import maybe_notify_streak_break_on_transition

logger = logging.getLogger(__name__)


def run_session_presence_job(db: DBSession, settings: Settings) -> dict:
    now = utcnow()
    sessions = list(
        db.scalars(
            select(ProductionSession).where(
                ProductionSession.stopped_at.is_(None),
                ProductionSession.deleted_at.is_(None),
                ProductionSession.pause_started_at.is_(None),
            )
        ).all()
    )
    nudged = 0
    stopped = 0
    for session in sessions:
        action = decide_session_presence(
            effective_elapsed_seconds(session, now),
            is_running=True,
            already_nudged=session.still_there_notified_at is not None,
        )
        if action == "nudge" and _nudge(db, settings, session, now):
            nudged += 1
        elif action == "stop" and _stop(db, settings, session, now):
            stopped += 1
    return {"nudged": nudged, "stopped": stopped, "scanned": len(sessions)}


def _nudge(db: DBSession, settings: Settings, session: ProductionSession, now) -> bool:
    title, body = push_templates.session_still_there()
    try:
        dispatch_to_user(
            settings,
            db,
            session.user_id,
            title,
            body,
            data={**push_data_dashboard(), "kind": "session_still_there"},
        )
        session.still_there_notified_at = now
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("session still-there push failed session_id=%s", session.id)
        return False
    return True


def _stop(db: DBSession, settings: Settings, session: ProductionSession, now) -> bool:
    user_id = session.user_id
    deadline = stop_deadline(session, now)
    try:
        completion = complete_session(db, user_id, session, stopped_at=deadline)
    except Exception:
        db.rollback()
        logger.exception("session auto-stop failed session_id=%s", session.id)
        return False
    maybe_notify_streak_break_on_transition(
        completion.previous_streak,
        completion.current_streak,
        user_id,
    )
    title, body = push_templates.session_auto_stopped()
    try:
        dispatch_to_user(
            settings,
            db,
            user_id,
            title,
            body,
            data={**push_data_dashboard(), "kind": "session_auto_stopped"},
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("session auto-stop push failed session_id=%s", session.id)
    try:
        events = PushChallengeEvents(db, settings)
        for challenge_id in completion.finished_challenge_ids:
            events.challenge_finished(challenge_id)
    except Exception:
        logger.exception("session auto-stop challenge notify failed session_id=%s", session.id)
    return True


def main() -> None:
    from app.config import settings as app_settings
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        print(run_session_presence_job(db, app_settings))
    finally:
        db.close()


if __name__ == "__main__":
    main()
