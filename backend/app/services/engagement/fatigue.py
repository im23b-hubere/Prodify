"""
Notification fatigue: back off when pushes keep being ignored, so producers never feel the
need to turn Prodify off. Everything is recomputed from the settled delivery history.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.models import DeliveryOutcome
from app.services.engagement.priority import HIGH_THRESHOLD, SEND_THRESHOLD

FATIGUE_PER_IGNORED = 10
FATIGUE_RECOVERY_PER_CONVERSION = 15
FATIGUE_RECOVERY_PER_OPEN = 5
MAX_FATIGUE = 60

_PAUSE_BY_IGNORED_STREAK = {2: timedelta(hours=24), 3: timedelta(hours=48)}
_LONGEST_PAUSE = timedelta(hours=48)
HIGH_PRIORITY_ONLY_FROM = 4

_FATIGUE_CHANGE = {
    DeliveryOutcome.IGNORED: FATIGUE_PER_IGNORED,
    DeliveryOutcome.CONVERTED: -FATIGUE_RECOVERY_PER_CONVERSION,
    DeliveryOutcome.OPENED_ONLY: -FATIGUE_RECOVERY_PER_OPEN,
}


@dataclass(frozen=True)
class FatigueGate:
    """No smart push before `paused_until`; afterwards only candidates scoring `min_score`+."""

    paused_until: datetime | None
    min_score: int

    def is_paused(self, now: datetime) -> bool:
        return self.paused_until is not None and now < self.paused_until


def ignored_streak_of(outcomes_oldest_first: Sequence[str]) -> int:
    streak = 0
    for outcome in reversed(outcomes_oldest_first):
        if outcome != DeliveryOutcome.IGNORED:
            break
        streak += 1
    return streak


def fatigue_score_of(outcomes_oldest_first: Sequence[str]) -> float:
    score = 0
    for outcome in outcomes_oldest_first:
        score = min(MAX_FATIGUE, max(0, score + _FATIGUE_CHANGE.get(outcome, 0)))
    return score


def fatigue_gate(ignored_streak: int, last_smart_sent_at: datetime | None) -> FatigueGate:
    min_score = HIGH_THRESHOLD if ignored_streak >= HIGH_PRIORITY_ONLY_FROM else SEND_THRESHOLD
    pause = _pause_for(ignored_streak)
    if pause is None or last_smart_sent_at is None:
        return FatigueGate(paused_until=None, min_score=min_score)
    return FatigueGate(paused_until=last_smart_sent_at + pause, min_score=min_score)


def _pause_for(ignored_streak: int) -> timedelta | None:
    if ignored_streak >= max(_PAUSE_BY_IGNORED_STREAK):
        return _LONGEST_PAUSE
    return _PAUSE_BY_IGNORED_STREAK.get(ignored_streak)
