"""Load, recompute and store `user_engagement_profiles` rows."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import ProductionSession, UserEngagementProfile
from app.services.engagement.profile import BehaviorProfile, compute_profile
from app.services.push_dispatch import submit_deferred
from app.services.streak_calendar import load_calendar
from app.timeutil import as_utc_aware

logger = logging.getLogger(__name__)

PROFILE_MAX_AGE = timedelta(hours=6)


def refresh_profile(db: Session, user_id: int, now: datetime) -> UserEngagementProfile:
    """Recompute the producer's profile from their completed sessions; the caller commits."""
    behavior = compute_profile(_completed_sessions(db, user_id), load_calendar(db, user_id), now)
    row = db.get(UserEngagementProfile, user_id)
    if row is None:
        row = UserEngagementProfile(user_id=user_id)
        db.add(row)
    row.total_sessions = behavior.total_sessions
    row.stage = behavior.stage
    row.session_hour_histogram_json = json.dumps(behavior.session_hour_histogram)
    row.weekday_histogram_json = json.dumps(behavior.weekday_histogram)
    row.avg_sessions_per_week = behavior.avg_sessions_per_week
    row.avg_session_duration_minutes = behavior.avg_session_duration_minutes
    row.last_session_at = behavior.last_session_at
    row.sessions_last_7_days = behavior.sessions_last_7_days
    row.sessions_previous_7_days = behavior.sessions_previous_7_days
    row.last_session_duration_minutes = behavior.last_session_duration_minutes
    row.updated_at = now
    db.flush()
    return row


def behavior_of(row: UserEngagementProfile) -> BehaviorProfile:
    return BehaviorProfile(
        total_sessions=row.total_sessions,
        stage=row.stage,
        session_hour_histogram=json.loads(row.session_hour_histogram_json) or [0] * 24,
        weekday_histogram=json.loads(row.weekday_histogram_json) or [0] * 7,
        avg_sessions_per_week=row.avg_sessions_per_week,
        avg_session_duration_minutes=row.avg_session_duration_minutes,
        last_session_at=row.last_session_at,
        sessions_last_7_days=row.sessions_last_7_days,
        sessions_previous_7_days=row.sessions_previous_7_days,
        last_session_duration_minutes=row.last_session_duration_minutes,
    )


def load_fresh_profile(db: Session, user_id: int, now: datetime) -> BehaviorProfile:
    """The stored profile, recomputed first when it is missing or older than `PROFILE_MAX_AGE`."""
    row = db.get(UserEngagementProfile, user_id)
    if row is None or as_utc_aware(now) - as_utc_aware(row.updated_at) > PROFILE_MAX_AGE:
        row = refresh_profile(db, user_id, now)
    return behavior_of(row)


def schedule_profile_refresh(settings: Settings, user_id: int) -> None:
    """Recompute after a completed session, outside the request that completed it."""

    def run_refresh() -> None:
        from app.database import SessionLocal
        from app.models import utcnow

        try:
            with SessionLocal() as background_db:
                refresh_profile(background_db, user_id, utcnow())
                background_db.commit()
        except Exception:
            logger.exception("engagement profile refresh failed user_id=%s", user_id)

    submit_deferred(settings, run_refresh, "engagement-profile")


def _completed_sessions(db: Session, user_id: int) -> list[ProductionSession]:
    return list(
        db.scalars(
            select(ProductionSession).where(
                ProductionSession.user_id == user_id,
                ProductionSession.deleted_at.is_(None),
                ProductionSession.duration_seconds.is_not(None),
            )
        ).all()
    )
