"""Recompute and read what the engine has learned from a producer's settled pushes."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DeliveryOutcome, NotificationDelivery, UserEngagementProfile
from app.services.engagement.deliveries import TRANSACTIONAL_TYPES
from app.services.engagement.fatigue import fatigue_score_of, ignored_streak_of
from app.services.engagement.motivation import (
    category_priors_from_counts,
    motivation_scores,
    preferred_notification_hour,
)
from app.services.engagement.preferences import NotificationCategory, category_of
from app.services.engagement.profile_store import refresh_profile
from app.services.streak_calendar import load_calendar

LEARNING_LOOKBACK = timedelta(days=90)


@dataclass(frozen=True)
class LearnedSignals:
    motivation: dict[NotificationCategory, float] = field(default_factory=dict)
    fatigue_score: float = 0
    ignored_streak: int = 0
    preferred_notification_hour: int | None = None


def refresh_learning(db: Session, user_id: int, now: datetime) -> None:
    """Recompute fatigue, motivation and send hour from the settled history; the caller commits."""
    db.flush()
    history = _settled_history(db, user_id, now)
    row = db.get(UserEngagementProfile, user_id) or refresh_profile(db, user_id, now)
    outcomes = [delivery.outcome for delivery in history]
    row.fatigue_score = fatigue_score_of(outcomes)
    row.ignored_streak = ignored_streak_of(outcomes)
    row.motivation_scores_json = json.dumps(
        {
            category.value: round(rate, 4)
            for category, rate in motivation_scores(history, _observed_priors(db, now)).items()
        }
    )
    row.preferred_notification_hour = preferred_notification_hour(history, load_calendar(db, user_id).zone, row.stage)
    db.flush()


def learned_signals(row: UserEngagementProfile | None) -> LearnedSignals:
    if row is None:
        return LearnedSignals()
    stored = json.loads(row.motivation_scores_json or "{}")
    return LearnedSignals(
        motivation={NotificationCategory(name): rate for name, rate in stored.items()},
        fatigue_score=row.fatigue_score,
        ignored_streak=row.ignored_streak,
        preferred_notification_hour=row.preferred_notification_hour,
    )


def _observed_priors(db: Session, now: datetime) -> dict:
    """Conversion across every producer, so a new account starts from what actually works here."""
    sent: Counter = Counter()
    converted: Counter = Counter()
    rows = db.execute(
        select(NotificationDelivery.notification_type, NotificationDelivery.outcome).where(
            NotificationDelivery.outcome != DeliveryOutcome.PENDING,
            NotificationDelivery.delivered_count > 0,
            NotificationDelivery.notification_type.not_in(TRANSACTIONAL_TYPES),
            NotificationDelivery.sent_at >= now - LEARNING_LOOKBACK,
        )
    ).all()
    for notification_type, outcome in rows:
        category = category_of(notification_type)
        if category is None:
            continue
        sent[category] += 1
        converted[category] += outcome == DeliveryOutcome.CONVERTED
    return category_priors_from_counts(sent, converted)


def _settled_history(db: Session, user_id: int, now: datetime) -> list[NotificationDelivery]:
    return list(
        db.scalars(
            select(NotificationDelivery)
            .where(
                NotificationDelivery.user_id == user_id,
                NotificationDelivery.outcome != DeliveryOutcome.PENDING,
                NotificationDelivery.delivered_count > 0,
                NotificationDelivery.notification_type.not_in(TRANSACTIONAL_TYPES),
                NotificationDelivery.sent_at >= now - LEARNING_LOOKBACK,
            )
            .order_by(NotificationDelivery.sent_at)
        ).all()
    )
