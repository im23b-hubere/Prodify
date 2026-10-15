"""
Engagement engine heartbeat. Run every 15-30 minutes: python -m app.jobs.run_engagement_engine

Each run settles expired deliveries and, with `feature_flag_smart_notifications_enabled`,
lets the engine decide for every reachable producer whether one push goes out.
"""

from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session as DBSession

from app.config import Settings
from app.models import PushToken, User, UserNotificationPreferences, utcnow
from app.services.engagement.context import (
    EngagementContext,
    load_engagement_context,
    record_leaderboard_snapshot,
    record_return_outlook,
)
from app.services.engagement.deliveries import EngineChoice, settle_expired_deliveries
from app.services.engagement.engine import EngagementDecision, decide, log_decision
from app.services.engagement.learning_store import refresh_learning
from app.services.engagement.preferences import load_preferences
from app.services.push_dispatch import dispatch_to_user
from app.services.streak_calendar import StreakCalendar

logger = logging.getLogger(__name__)


def run_engagement_job(db: DBSession, settings: Settings, now: datetime | None = None) -> dict:
    run_at = now or utcnow()
    settled = settle_expired_deliveries(db, run_at)
    for user_id in {delivery.user_id for delivery in settled}:
        refresh_learning(db, user_id, run_at)
    db.commit()
    engine = _run_engine(db, settings, run_at) if settings.feature_flag_smart_notifications_enabled else "disabled"
    return {"deliveries_settled": len(settled), "engine": engine}


def _run_engine(db: DBSession, settings: Settings, run_at: datetime) -> dict[str, int]:
    evaluated = sent = 0
    for user_id in _reachable_smart_audience(db):
        evaluated += 1
        try:
            sent += _evaluate_and_send(db, settings, user_id, run_at)
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("[EngagementEngine] evaluation failed user_id=%s", user_id)
    return {"evaluated": evaluated, "sent": sent}


def _reachable_smart_audience(db: DBSession) -> list[int]:
    """Producers with an active push token who did not turn smart notifications off."""
    return list(
        db.scalars(
            select(User.id)
            .join(PushToken, PushToken.user_id == User.id)
            .outerjoin(UserNotificationPreferences, UserNotificationPreferences.user_id == User.id)
            .where(
                PushToken.is_active == 1,
                or_(UserNotificationPreferences.user_id.is_(None), UserNotificationPreferences.smart_enabled.is_(True)),
            )
            .distinct()
        ).all()
    )


def _evaluate_and_send(db: DBSession, settings: Settings, user_id: int, run_at: datetime) -> int:
    context = load_engagement_context(db, user_id, run_at)
    decision = decide(context, load_preferences(db, user_id), run_at)
    if settings.environment == "development":
        log_decision(user_id, decision)
    _remember_leaderboard_place(db, context, run_at)
    record_return_outlook(db, context, run_at)
    if not decision.should_send:
        return 0
    return _send(db, settings, user_id, decision, run_at)


def _remember_leaderboard_place(db: DBSession, context: EngagementContext, run_at: datetime) -> None:
    if context.leaderboard is None:
        return
    record_leaderboard_snapshot(db, context.user_id, context.leaderboard, StreakCalendar(context.zone), run_at)


def _send(db: DBSession, settings: Settings, user_id: int, decision: EngagementDecision, run_at: datetime) -> int:
    candidate = decision.chosen.candidate
    attempted, _, message = dispatch_to_user(
        settings,
        db,
        user_id,
        candidate.title,
        candidate.body,
        data={"path": candidate.path, "kind": candidate.type.value},
        now=run_at,
        choice=EngineChoice(score=decision.score, reason=decision.reason, variables=candidate.variables),
    )
    if attempted == 0:
        logger.info("[EngagementEngine] not sent user_id=%s: %s", user_id, message)
    return 1 if attempted > 0 else 0


def main() -> None:
    from app.config import settings as app_settings
    from app.database import SessionLocal

    with SessionLocal() as db:
        print(run_engagement_job(db, app_settings))


if __name__ == "__main__":
    main()
