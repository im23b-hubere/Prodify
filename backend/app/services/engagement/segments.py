"""Which kind of producer someone is right now, so the engine can weigh pushes per segment."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from enum import StrEnum
from types import MappingProxyType

from app.services.engagement.preferences import NotificationCategory
from app.services.engagement.profile import STAGE_COLD_START, BehaviorProfile

DORMANT_AFTER_DAYS = 14
ACTIVE_SESSIONS_PER_WEEK = 3
POWER_SESSIONS_PER_WEEK = 7
# A drop only counts once the earlier week had enough sessions to fall from.
AT_RISK_MIN_PREVIOUS_SESSIONS = 2
AT_RISK_DROP_SHARE = 0.5


class Segment(StrEnum):
    NEW_USER = "new_user"
    CASUAL_PRODUCER = "casual_producer"
    ACTIVE_PRODUCER = "active_producer"
    POWER_USER = "power_user"
    AT_RISK = "at_risk"
    DORMANT = "dormant"


def segment_of(profile: BehaviorProfile, now: datetime) -> Segment:
    days_away = profile.days_since_last_session(now)
    if days_away is not None and days_away >= DORMANT_AFTER_DAYS:
        return Segment.DORMANT
    if profile.stage == STAGE_COLD_START:
        return Segment.NEW_USER
    if _activity_dropped(profile):
        return Segment.AT_RISK
    if profile.avg_sessions_per_week >= POWER_SESSIONS_PER_WEEK:
        return Segment.POWER_USER
    if profile.avg_sessions_per_week >= ACTIVE_SESSIONS_PER_WEEK:
        return Segment.ACTIVE_PRODUCER
    return Segment.CASUAL_PRODUCER


def _activity_dropped(profile: BehaviorProfile) -> bool:
    previous = profile.sessions_previous_7_days
    return previous >= AT_RISK_MIN_PREVIOUS_SESSIONS and profile.sessions_last_7_days < previous * AT_RISK_DROP_SHARE


# Producers who come anyway need fewer comeback nudges; slipping ones more.
SEGMENT_CATEGORY_MULTIPLIERS: Mapping[Segment, Mapping[NotificationCategory, float]] = MappingProxyType(
    {
        Segment.POWER_USER: {NotificationCategory.REENGAGEMENT: 0.5},
        Segment.AT_RISK: {NotificationCategory.REENGAGEMENT: 1.3, NotificationCategory.SOCIAL: 1.2},
        Segment.DORMANT: {NotificationCategory.REENGAGEMENT: 1.5},
    }
)
