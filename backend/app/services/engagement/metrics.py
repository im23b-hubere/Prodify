"""
Engagement metrics for the KPI dashboard: does the engine bring producers back, and what does it cost?

Push metrics only count smart pushes that reached a device; transactional pushes are left out.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.contracts.engagement import (
    EngagementMetricsPublic,
    EngagementNegativeMetrics,
    EngagementPrimaryMetrics,
    EngagementSecondaryMetrics,
)
from app.models import (
    DeliveryOutcome,
    NotificationDelivery,
    ProductionSession,
    PushToken,
    SocialChallenge,
    SocialChallengeMember,
    Streak,
    User,
    UserNotificationPreferences,
)
from app.services.engagement.deliveries import TRANSACTIONAL_TYPES
from app.services.engagement.preferences import NotificationCategory, category_of
from app.timeutil import as_utc_aware

RETENTION_DAYS = (1, 7, 30)
WEEK = timedelta(days=7)
CHALLENGE_LOOKBACK = timedelta(days=30)
# A streak still counts as alive while its last streak day is at most this old.
STREAK_ALIVE_WITHIN = timedelta(hours=48)


@dataclass(frozen=True)
class _PushOutcomes:
    delivered: int
    opened: int
    settled: int
    converted: int
    ignored: int
    social_settled: int
    social_converted: int


def engagement_metrics(db: Session, now: datetime, window_days: int) -> EngagementMetricsPublic:
    since = now - timedelta(days=window_days)
    pushes = _push_outcomes(db, since)
    retention = _retention(db, now)
    return EngagementMetricsPublic(
        smart_notifications_delivered=pushes.delivered,
        primary=EngagementPrimaryMetrics(
            notification_conversion_rate=_rate(pushes.converted, pushes.settled),
            sessions_per_active_user=_rate(_completed_sessions(db, since), _active_producers(db, since)),
            weekly_active_producers=_active_producers(db, now - WEEK),
            retention_d1=retention[1],
            retention_d7=retention[7],
            retention_d30=retention[30],
        ),
        secondary=EngagementSecondaryMetrics(
            notification_open_rate=_rate(pushes.opened, pushes.delivered),
            avg_session_duration_minutes=_avg_session_minutes(db, since),
            streak_retention_rate=_streak_retention(db, now),
            challenge_completion_rate=_challenge_completion(db, now),
            social_conversion_rate=_rate(pushes.social_converted, pushes.social_settled),
        ),
        negative=EngagementNegativeMetrics(
            smart_opt_out_rate=_smart_opt_out_rate(db),
            push_token_inactive_rate=_push_token_inactive_rate(db),
            notifications_ignored=pushes.ignored,
            notification_ignore_rate=_rate(pushes.ignored, pushes.settled),
            session_abandon_rate=_session_abandon_rate(db, since),
        ),
    )


def _rate(part: float, whole: float) -> float:
    return round(part / whole, 4) if whole > 0 else 0.0


def _push_outcomes(db: Session, since: datetime) -> _PushOutcomes:
    rows = db.execute(
        select(NotificationDelivery.notification_type, NotificationDelivery.outcome, NotificationDelivery.opened_at).where(
            NotificationDelivery.sent_at >= since,
            NotificationDelivery.delivered_count > 0,
            NotificationDelivery.notification_type.not_in(TRANSACTIONAL_TYPES),
        )
    ).all()
    settled = [(kind, outcome) for kind, outcome, _ in rows if outcome != DeliveryOutcome.PENDING]
    social = [outcome for kind, outcome in settled if category_of(kind) == NotificationCategory.SOCIAL]
    return _PushOutcomes(
        delivered=len(rows),
        opened=sum(opened_at is not None for _, _, opened_at in rows),
        settled=len(settled),
        converted=sum(outcome == DeliveryOutcome.CONVERTED for _, outcome in settled),
        ignored=sum(outcome == DeliveryOutcome.IGNORED for _, outcome in settled),
        social_settled=len(social),
        social_converted=social.count(DeliveryOutcome.CONVERTED),
    )


def _completed_session_filter(since: datetime):
    return (
        ProductionSession.duration_seconds.is_not(None),
        ProductionSession.deleted_at.is_(None),
        ProductionSession.started_at >= since,
    )


def _completed_sessions(db: Session, since: datetime) -> int:
    return db.scalar(select(func.count()).select_from(ProductionSession).where(*_completed_session_filter(since))) or 0


def _active_producers(db: Session, since: datetime) -> int:
    query = select(func.count(func.distinct(ProductionSession.user_id))).where(*_completed_session_filter(since))
    return db.scalar(query) or 0


def _avg_session_minutes(db: Session, since: datetime) -> float:
    seconds = db.scalar(select(func.avg(ProductionSession.duration_seconds)).where(*_completed_session_filter(since)))
    return round(float(seconds) / 60, 1) if seconds else 0.0


def _retention(db: Session, now: datetime) -> dict[int, float]:
    """Share of producers at least N days old who completed a session N or more days after signing up."""
    last_session = (
        select(ProductionSession.user_id, func.max(ProductionSession.started_at).label("last_started_at"))
        .where(ProductionSession.duration_seconds.is_not(None), ProductionSession.deleted_at.is_(None))
        .group_by(ProductionSession.user_id)
        .subquery()
    )
    producers = db.execute(
        select(User.created_at, last_session.c.last_started_at).outerjoin(
            last_session, last_session.c.user_id == User.id
        )
    ).all()
    retention: dict[int, float] = {}
    for days in RETENTION_DAYS:
        age = timedelta(days=days)
        cohort = [(as_utc_aware(created), last) for created, last in producers if as_utc_aware(created) <= now - age]
        retained = sum(last is not None and as_utc_aware(last) >= created + age for created, last in cohort)
        retention[days] = _rate(retained, len(cohort))
    return retention


def _streak_retention(db: Session, now: datetime) -> float:
    """Of producers who ever built a streak, the share whose streak is still alive."""
    ever = db.scalar(select(func.count()).select_from(Streak).where(Streak.longest_streak > 0)) or 0
    alive = (
        db.scalar(
            select(func.count())
            .select_from(Streak)
            .where(Streak.current_streak > 0, Streak.last_session_date >= now - STREAK_ALIVE_WITHIN)
        )
        or 0
    )
    return _rate(alive, ever)


def _challenge_completion(db: Session, now: datetime) -> float:
    """Of members in challenges that finished (started within 30 days), the share who hit the target."""
    rows = db.execute(
        select(SocialChallengeMember.progress_sessions, SocialChallenge.target_sessions)
        .join(SocialChallenge, SocialChallenge.id == SocialChallengeMember.challenge_id)
        .where(SocialChallenge.status == "completed", SocialChallenge.created_at >= now - CHALLENGE_LOOKBACK)
    ).all()
    return _rate(sum(progress >= target for progress, target in rows), len(rows))


def _smart_opt_out_rate(db: Session) -> float:
    producers = db.scalar(select(func.count()).select_from(User)) or 0
    opted_out = (
        db.scalar(
            select(func.count())
            .select_from(UserNotificationPreferences)
            .where(UserNotificationPreferences.smart_enabled.is_(False))
        )
        or 0
    )
    return _rate(opted_out, producers)


def _push_token_inactive_rate(db: Session) -> float:
    tokens = db.scalar(select(func.count()).select_from(PushToken)) or 0
    inactive = db.scalar(select(func.count()).select_from(PushToken).where(PushToken.is_active == 0)) or 0
    return _rate(inactive, tokens)


def _session_abandon_rate(db: Session, since: datetime) -> float:
    """Sessions started in the window that the producer deleted again."""
    started = db.scalar(select(func.count()).select_from(ProductionSession).where(ProductionSession.started_at >= since)) or 0
    deleted = (
        db.scalar(
            select(func.count())
            .select_from(ProductionSession)
            .where(ProductionSession.started_at >= since, ProductionSession.deleted_at.is_not(None))
        )
        or 0
    )
    return _rate(deleted, started)
