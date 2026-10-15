"""Dry-run of the engine for the signed-in producer, shaped for the development debug screen."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts.engagement import (
    EngagementCandidateDebug,
    EngagementDebugPublic,
    EngagementDecisionDebug,
    EngagementProfileDebug,
    LastDeliveryDebug,
    ProductionWindowDebug,
)
from app.models import NotificationDelivery, UserEngagementProfile
from app.services.engagement.context import EngagementContext, load_engagement_context
from app.services.engagement.deliveries import TRANSACTIONAL_TYPES
from app.services.engagement.engine import EngagementDecision, ScoredCandidate, decide
from app.services.engagement.preferences import load_preferences
from app.services.engagement.timing import production_window


def engagement_debug(db: Session, user_id: int, now: datetime) -> EngagementDebugPublic:
    """Nothing is sent and nothing is stored; the caller must not commit."""
    context = load_engagement_context(db, user_id, now)
    decision = decide(context, load_preferences(db, user_id), now)
    row = db.get(UserEngagementProfile, user_id)
    return EngagementDebugPublic(
        evaluated_at=now,
        profile=_profile(context, now),
        production_window=_window(context),
        preferred_notification_hour=context.preferred_notification_hour,
        segment=row.segment if row else None,
        return_probability_24h=row.return_probability_24h if row else None,
        fatigue_score=context.fatigue_score,
        ignored_streak=context.ignored_streak,
        motivation={category.value: rate for category, rate in context.motivation.items()},
        last_delivery=_last_delivery(db, user_id),
        candidates=[_candidate(scored) for scored in decision.candidates],
        decision=_decision(decision),
    )


def _profile(context: EngagementContext, now: datetime) -> EngagementProfileDebug:
    profile = context.profile
    return EngagementProfileDebug(
        stage=profile.stage,
        total_sessions=profile.total_sessions,
        avg_sessions_per_week=profile.avg_sessions_per_week,
        avg_session_duration_minutes=profile.avg_session_duration_minutes,
        sessions_last_7_days=profile.sessions_last_7_days,
        sessions_previous_7_days=profile.sessions_previous_7_days,
        days_since_last_session=profile.days_since_last_session(now),
        preferred_hours=profile.preferred_hours(),
    )


def _window(context: EngagementContext) -> ProductionWindowDebug:
    window = production_window(context.profile)
    return ProductionWindowDebug(
        weekdays=list(window.weekdays),
        start_hour=window.start_hour,
        end_hour=window.end_hour,
        is_default=window.is_default,
    )


def _last_delivery(db: Session, user_id: int) -> LastDeliveryDebug | None:
    delivery = db.scalar(
        select(NotificationDelivery)
        .where(
            NotificationDelivery.user_id == user_id,
            NotificationDelivery.notification_type.not_in(TRANSACTIONAL_TYPES),
        )
        .order_by(NotificationDelivery.sent_at.desc())
        .limit(1)
    )
    if delivery is None:
        return None
    return LastDeliveryDebug(
        notification_type=delivery.notification_type,
        sent_at=delivery.sent_at,
        outcome=delivery.outcome,
        candidate_score=delivery.candidate_score,
        reason=delivery.reason,
    )


def _candidate(scored: ScoredCandidate) -> EngagementCandidateDebug:
    candidate = scored.candidate
    return EngagementCandidateDebug(
        type=candidate.type.value,
        category=candidate.category.value,
        title=candidate.title,
        body=candidate.body,
        reason=candidate.reason,
        total=scored.total,
        priority=scored.breakdown.priority.value,
        parts=scored.breakdown.parts,
        verdict=scored.verdict,
        is_eligible=scored.is_eligible,
    )


def _decision(decision: EngagementDecision) -> EngagementDecisionDebug:
    return EngagementDecisionDebug(
        should_send=decision.should_send,
        chosen_type=decision.type.value if decision.type else None,
        score=decision.score,
        reason=decision.reason,
        scheduled_at=decision.scheduled_at,
    )
