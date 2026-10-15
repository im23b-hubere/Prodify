"""
Which kinds of push a producer actually answers with a session, and at which local hour.

Rates are smoothed towards a prior so that one lucky push does not read as certainty and
new producers start from sensible values.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Mapping
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
# A category's own rate replaces the constant only once this many pushes have settled.
MIN_GLOBAL_SENDS = 30
MIN_PRIOR = 0.05
MAX_PRIOR = 0.75


class SettledDelivery(Protocol):
    notification_type: str
    outcome: str
    sent_at: datetime


def smoothed_rate(*, conversions: int, sent: int, prior: float) -> float:
    return (conversions + prior * PRIOR_STRENGTH) / (sent + PRIOR_STRENGTH)


def motivation_scores(
    deliveries: Iterable[SettledDelivery],
    priors: Mapping[NotificationCategory, float] | None = None,
) -> dict[NotificationCategory, float]:
    sent: Counter[NotificationCategory] = Counter()
    converted: Counter[NotificationCategory] = Counter()
    for delivery, category in _learnable(deliveries):
        sent[category] += 1
        converted[category] += delivery.outcome == DeliveryOutcome.CONVERTED
    return {
        category: smoothed_rate(conversions=converted[category], sent=sent[category], prior=prior)
        for category, prior in (priors or CATEGORY_PRIORS).items()
    }


def category_priors_from_counts(
    sent: Mapping[NotificationCategory, int],
    converted: Mapping[NotificationCategory, int],
) -> dict[NotificationCategory, float]:
    """The hand-set prior, replaced by the observed rate once a category has enough settled pushes."""
    priors = dict(CATEGORY_PRIORS)
    for category in CATEGORY_PRIORS:
        count = sent.get(category, 0)
        if count < MIN_GLOBAL_SENDS:
            continue
        rate = converted.get(category, 0) / count
        priors[category] = min(MAX_PRIOR, max(MIN_PRIOR, rate))
    return priors


def preferred_notification_slots(
    deliveries: Iterable[SettledDelivery], zone: ZoneInfo, stage: int
) -> dict[int, int]:
    """Best local hour per weekday, once that weekday has enough evidence. 0 is Monday."""
    if stage < STAGE_ESTABLISHED:
        return {}
    grouped: dict[int, list[SettledDelivery]] = {}
    for delivery in deliveries:
        grouped.setdefault(in_zone(delivery.sent_at, zone).weekday(), []).append(delivery)
    return {
        weekday: hour
        for weekday, history in grouped.items()
        if (hour := preferred_notification_hour(history, zone, stage)) is not None
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
