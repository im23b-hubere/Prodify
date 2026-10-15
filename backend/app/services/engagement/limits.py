"""
Hard limits on smart notifications, checked before the engine sends anything.

Transactional pushes neither count toward nor are held back by these limits.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Protocol
from zoneinfo import ZoneInfo

from app.models import UserNotificationPreferences
from app.services.engagement.deliveries import TRANSACTIONAL_TYPES
from app.services.engagement.preferences import NotificationCategory, category_of, preference_block
from app.timeutil import as_utc_aware, in_zone

MAX_SMART_PER_DAY = 2
MIN_SPACING = timedelta(hours=6)
REENGAGEMENT_COOLDOWN = timedelta(days=3)


class LimitReason(StrEnum):
    OK = "ok"
    SMART_DISABLED = "smart_disabled"
    CATEGORY_DISABLED = "category_disabled"
    QUIET_HOURS = "quiet_hours"
    DAILY_LIMIT = "daily_limit"
    MIN_SPACING = "min_spacing"
    REENGAGEMENT_COOLDOWN = "reengagement_cooldown"
    FATIGUE_PAUSE = "fatigue_pause"


@dataclass(frozen=True)
class LimitDecision:
    reason: LimitReason

    @property
    def allowed(self) -> bool:
        return self.reason == LimitReason.OK


class SentNotification(Protocol):
    notification_type: str
    sent_at: datetime


def is_send_allowed(
    recent_deliveries: Iterable[SentNotification],
    now: datetime,
    prefs: UserNotificationPreferences,
    zone: ZoneInfo,
    *,
    category: NotificationCategory,
) -> LimitDecision:
    """Whether a smart notification of `category` may go out now, and if not, why."""
    local_now = in_zone(now, zone)
    blocked_by_preferences = preference_block(prefs, category, local_now.time())
    if blocked_by_preferences is not None:
        return LimitDecision(LimitReason(blocked_by_preferences.value))

    now_utc = as_utc_aware(now)
    smart_sent = [
        (delivery.notification_type, as_utc_aware(delivery.sent_at))
        for delivery in recent_deliveries
        if delivery.notification_type not in TRANSACTIONAL_TYPES and _was_delivered(delivery)
    ]
    sent_today = sum(in_zone(sent_at, zone).date() == local_now.date() for _, sent_at in smart_sent)
    if sent_today >= MAX_SMART_PER_DAY:
        return LimitDecision(LimitReason.DAILY_LIMIT)
    if any(now_utc - sent_at < MIN_SPACING for _, sent_at in smart_sent):
        return LimitDecision(LimitReason.MIN_SPACING)
    if category == NotificationCategory.REENGAGEMENT and any(
        category_of(notification_type) == NotificationCategory.REENGAGEMENT
        and now_utc - sent_at < REENGAGEMENT_COOLDOWN
        for notification_type, sent_at in smart_sent
    ):
        return LimitDecision(LimitReason.REENGAGEMENT_COOLDOWN)
    return LimitDecision(LimitReason.OK)


def _was_delivered(delivery: SentNotification) -> bool:
    """A push that never reached a device must not use up a send slot."""
    return getattr(delivery, "delivered_count", 1) > 0
