"""
Which kinds of push a producer actually answers with a session, and at which local hour.

Rates are smoothed towards a prior so that one lucky push does not read as certainty and
new producers start from sensible values.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from datetime import datetime
from typing import Protocol
from zoneinfo import ZoneInfo

from app.models import DeliveryOutcome
from app.services.engagement.preferences import NotificationCategory, category_of
from app.services.engagement.profile import STAGE_ESTABLISHED
from app.timeutil import in_zone

# Expected conversion per category before the producer's own data says otherwise.
CATEGORY_PRIORS: dict[NotificationCategory, float] = {
    NotificationCategory.STREAK: 0.25,
    NotificationCategory.SOCIAL: 0.30,
    NotificationCategory.CHALLENGE: 0.25,
    NotificationCategory.RANK: 0.20,
    NotificationCategory.REENGAGEMENT: 0.15,
}
HOUR_PRIOR = 0.25
# How many pushes' worth of weight the prior carries.
PRIOR_STRENGTH = 5
MIN_SENDS_PER_HOUR = 3


class SettledDelivery(Protocol):
    notification_type: str
    outcome: str
    sent_at: datetime


def smoothed_rate(*, conversions: int, sent: int, prior: float) -> float:
    return (conversions + prior * PRIOR_STRENGTH) / (sent + PRIOR_STRENGTH)


def motivation_scores(deliveries: Iterable[SettledDelivery]) -> dict[NotificationCategory, float]:
    sent: Counter[NotificationCategory] = Counter()
    converted: Counter[NotificationCategory] = Counter()
    for delivery, category in _learnable(deliveries):
        sent[category] += 1
        converted[category] += delivery.outcome == DeliveryOutcome.CONVERTED
    return {
        category: smoothed_rate(conversions=converted[category], sent=sent[category], prior=prior)
        for category, prior in CATEGORY_PRIORS.items()
    }


def preferred_notification_hour(deliveries: Iterable[SettledDelivery], zone: ZoneInfo, stage: int) -> int | None:
    """The local hour whose pushes convert best, once an established producer gives enough evidence."""
    if stage < STAGE_ESTABLISHED:
        return None
    sent: Counter[int] = Counter()
    converted: Counter[int] = Counter()
    for delivery, _ in _learnable(deliveries):
        hour = in_zone(delivery.sent_at, zone).hour
        sent[hour] += 1
        converted[hour] += delivery.outcome == DeliveryOutcome.CONVERTED
    rates = {
        hour: smoothed_rate(conversions=converted[hour], sent=count, prior=HOUR_PRIOR)
        for hour, count in sent.items()
        if count >= MIN_SENDS_PER_HOUR
    }
    best = max(rates, key=lambda hour: (rates[hour], -hour), default=None)
    return best if best is not None and rates[best] > HOUR_PRIOR else None


def _learnable(deliveries: Iterable[SettledDelivery]):
    for delivery in deliveries:
        category = category_of(delivery.notification_type)
        if category is None or delivery.outcome == DeliveryOutcome.PENDING:
            continue
        yield delivery, category
