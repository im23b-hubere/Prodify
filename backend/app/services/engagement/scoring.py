"""
How strongly one candidate is worth sending right now, as a sum of named parts.

The parts stay separate so logs and the debug view can show why a push won or lost.
`ScoringWeights` is the seam where learned weights can replace the hand-tuned ones.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.services.engagement.candidates import Candidate
from app.services.engagement.preferences import NotificationCategory
from app.services.engagement.priority import Priority, priority_of
from app.services.engagement.timing import ProductionWindow
from app.timeutil import as_utc_aware, in_zone

_TRIGGER_PART = {
    NotificationCategory.STREAK: "streak",
    NotificationCategory.SOCIAL: "social",
    NotificationCategory.CHALLENGE: "challenge",
    NotificationCategory.RANK: "rank",
    NotificationCategory.REENGAGEMENT: "inactivity",
}
PART_NAMES = (
    "timeMatch",
    "inactivity",
    "streak",
    "social",
    "challenge",
    "rank",
    "motivation",
    "fatigue",
    "recentNotificationPenalty",
    "likelyReturn",
)


@dataclass(frozen=True)
class ScoringWeights:
    time_match: int = 25
    time_near: int = 10
    time_near_lead: timedelta = timedelta(hours=1)
    inactivity: int = 20
    inactivity_after_days: int = 2
    # Motivation scores are conversion rates; `motivation_neutral` is the rate that adds nothing.
    motivation: int = 40
    motivation_neutral: float = 0.25
    fatigue: float = 1.0
    recent_notification: int = 30
    recent_notification_fade: timedelta = timedelta(hours=24)
    # A producer this likely to return anyway needs the push less; the penalty grows to 1.0.
    likely_return: int = 15
    likely_return_from: float = 0.7
    category_multipliers: Mapping[NotificationCategory, float] = field(default_factory=dict)


DEFAULT_WEIGHTS = ScoringWeights()


@dataclass(frozen=True)
class ScoringSignals:
    """What scoring knows about the producer beyond the candidate itself."""

    window: ProductionWindow
    zone: ZoneInfo
    days_since_last_session: int | None
    last_smart_sent_at: datetime | None
    motivation: Mapping[NotificationCategory, float]
    fatigue_score: float
    return_probability: float | None = None


@dataclass(frozen=True)
class ScoreBreakdown:
    parts: dict[str, int]

    @property
    def total(self) -> int:
        return sum(self.parts.values())

    @property
    def priority(self) -> Priority:
        return priority_of(self.total)


def score(
    candidate: Candidate,
    signals: ScoringSignals,
    now: datetime,
    weights: ScoringWeights = DEFAULT_WEIGHTS,
) -> ScoreBreakdown:
    parts = dict.fromkeys(PART_NAMES, 0)
    multiplier = weights.category_multipliers.get(candidate.category, 1.0)
    parts[_TRIGGER_PART[candidate.category]] += round(candidate.base_score * multiplier)
    parts["timeMatch"] = _time_match(signals, now, weights)
    if candidate.category != NotificationCategory.REENGAGEMENT:
        parts["inactivity"] = _inactivity(signals, weights)
    parts["motivation"] = _motivation(candidate.category, signals, weights)
    parts["fatigue"] = -round(signals.fatigue_score * weights.fatigue)
    parts["recentNotificationPenalty"] = -_recent_notification_penalty(signals, now, weights)
    parts["likelyReturn"] = -_likely_return_penalty(signals, weights)
    return ScoreBreakdown(parts)


def _time_match(signals: ScoringSignals, now: datetime, weights: ScoringWeights) -> int:
    if _is_in_window(signals.window, in_zone(now, signals.zone)):
        return weights.time_match
    if _is_in_window(signals.window, in_zone(now + weights.time_near_lead, signals.zone)):
        return weights.time_near
    return 0


def _is_in_window(window: ProductionWindow, local: datetime) -> bool:
    if local.weekday() not in window.weekdays:
        return False
    if window.start_hour <= window.end_hour:
        return window.start_hour <= local.hour < window.end_hour
    return local.hour >= window.start_hour or local.hour < window.end_hour


def _inactivity(signals: ScoringSignals, weights: ScoringWeights) -> int:
    days = signals.days_since_last_session
    return weights.inactivity if days is not None and days >= weights.inactivity_after_days else 0


def _motivation(category: NotificationCategory, signals: ScoringSignals, weights: ScoringWeights) -> int:
    rate = signals.motivation.get(category, weights.motivation_neutral)
    return round((rate - weights.motivation_neutral) * weights.motivation)


def _recent_notification_penalty(signals: ScoringSignals, now: datetime, weights: ScoringWeights) -> int:
    if signals.last_smart_sent_at is None:
        return 0
    elapsed = as_utc_aware(now) - as_utc_aware(signals.last_smart_sent_at)
    remaining_share = 1 - elapsed / weights.recent_notification_fade
    return max(0, round(weights.recent_notification * remaining_share))


def _likely_return_penalty(signals: ScoringSignals, weights: ScoringWeights) -> int:
    probability = signals.return_probability
    if probability is None or probability <= weights.likely_return_from:
        return 0
    share = (probability - weights.likely_return_from) / (1 - weights.likely_return_from)
    return round(weights.likely_return * share)
