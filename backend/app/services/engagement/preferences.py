"""
Which pushes a producer allows, decided in one place for every server push.

Transactional pushes (session saved, still there?) always go out. Everything else needs the
"Smart Notifications" master toggle, its own category toggle, and, except for streak reminders
whose deadline is midnight, a local time outside the quiet hours.
"""

from __future__ import annotations

from datetime import datetime, time
from enum import StrEnum

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.contracts.notifications import NotificationPreferencesPublic, NotificationPreferencesUpdate
from app.models import User, UserNotificationPreferences, utcnow
from app.models_engagement import DEFAULT_QUIET_END_MINUTE, DEFAULT_QUIET_START_MINUTE
from app.services.engagement.deliveries import TRANSACTIONAL_TYPES
from app.services.engagement.events import EngagementEvent
from app.services.kpi_tracker import track_event_deduped
from app.timeutil import in_zone, resolve_timezone


class NotificationCategory(StrEnum):
    STREAK = "streak"
    SOCIAL = "social"
    CHALLENGE = "challenge"
    RANK = "rank"
    REENGAGEMENT = "reengagement"


_CATEGORY_BY_TYPE = {
    "streak_2h_left": NotificationCategory.STREAK,
    "streak_1h_left": NotificationCategory.STREAK,
    "streak_30m_left": NotificationCategory.STREAK,
    "streak_at_risk": NotificationCategory.STREAK,
    "rank_close": NotificationCategory.RANK,
    "social_friend_session": NotificationCategory.SOCIAL,
    "social_overtaken": NotificationCategory.SOCIAL,
    "friend_nudge": NotificationCategory.SOCIAL,
    "streak_broken": NotificationCategory.SOCIAL,
    "streak_encouragement": NotificationCategory.SOCIAL,
    "commitment_witness": NotificationCategory.SOCIAL,
    "duel_invite": NotificationCategory.CHALLENGE,
    "duel_accepted": NotificationCategory.CHALLENGE,
    "dashboard": NotificationCategory.REENGAGEMENT,
    "reengagement": NotificationCategory.REENGAGEMENT,
}
_CHALLENGE_TYPE_PREFIX = "challenge_"
_QUIET_HOURS_EXEMPT = frozenset({NotificationCategory.STREAK})


def category_of(notification_type: str) -> NotificationCategory | None:
    """The preference category of a push type; None for transactional or unknown types."""
    if notification_type in _CATEGORY_BY_TYPE:
        return _CATEGORY_BY_TYPE[notification_type]
    if notification_type.startswith(_CHALLENGE_TYPE_PREFIX):
        return NotificationCategory.CHALLENGE
    return None


def default_preferences(user_id: int) -> UserNotificationPreferences:
    """Unsaved preferences with the column defaults, for producers who never changed them."""
    return UserNotificationPreferences(
        user_id=user_id,
        smart_enabled=True,
        streak_enabled=True,
        social_enabled=True,
        challenge_enabled=True,
        rank_enabled=True,
        reengagement_enabled=True,
        quiet_start_minute=DEFAULT_QUIET_START_MINUTE,
        quiet_end_minute=DEFAULT_QUIET_END_MINUTE,
    )


def load_preferences(db: Session, user_id: int) -> UserNotificationPreferences:
    return db.get(UserNotificationPreferences, user_id) or default_preferences(user_id)


def save_preferences(db: Session, user_id: int, update: NotificationPreferencesUpdate) -> UserNotificationPreferences:
    prefs = db.get(UserNotificationPreferences, user_id)
    if prefs is None:
        prefs = UserNotificationPreferences(user_id=user_id)
        db.add(prefs)
    prefs.smart_enabled = update.smart_enabled
    for category in NotificationCategory:
        setattr(prefs, f"{category.value}_enabled", getattr(update, category.value))
    prefs.quiet_start_minute = update.quiet_start_minute
    prefs.quiet_end_minute = update.quiet_end_minute
    prefs.updated_at = utcnow()
    return prefs


def preferences_public(prefs: UserNotificationPreferences) -> NotificationPreferencesPublic:
    return NotificationPreferencesPublic(
        smart_enabled=prefs.smart_enabled,
        **{category.value: getattr(prefs, f"{category.value}_enabled") for category in NotificationCategory},
        quiet_start_minute=prefs.quiet_start_minute,
        quiet_end_minute=prefs.quiet_end_minute,
        customized=inspect(prefs).persistent,
    )


def record_notification_permission(db: Session, user_id: int, *, granted: bool, now: datetime) -> None:
    """A revoked device permission is the clearest opt-out signal; record it once per day."""
    if granted:
        return
    track_event_deduped(
        db,
        user_id=user_id,
        bucket_key=f"{EngagementEvent.NOTIFICATIONS_DISABLED}:{now.date().isoformat()}",
        event_name=EngagementEvent.NOTIFICATIONS_DISABLED,
    )


def is_within_quiet_hours(prefs: UserNotificationPreferences, local_time: time) -> bool:
    minute = local_time.hour * 60 + local_time.minute
    start, end = prefs.quiet_start_minute, prefs.quiet_end_minute
    if start == end:
        return False
    if start < end:
        return start <= minute < end
    return minute >= start or minute < end


class PreferenceBlock(StrEnum):
    SMART_DISABLED = "smart_disabled"
    CATEGORY_DISABLED = "category_disabled"
    QUIET_HOURS = "quiet_hours"


def preference_block(
    prefs: UserNotificationPreferences,
    category: NotificationCategory | None,
    local_time: time,
) -> PreferenceBlock | None:
    """Why the producer's preferences hold this push back right now, or None if they allow it."""
    if not prefs.smart_enabled:
        return PreferenceBlock.SMART_DISABLED
    if category is not None and not getattr(prefs, f"{category.value}_enabled"):
        return PreferenceBlock.CATEGORY_DISABLED
    if category not in _QUIET_HOURS_EXEMPT and is_within_quiet_hours(prefs, local_time):
        return PreferenceBlock.QUIET_HOURS
    return None


def is_category_allowed(
    prefs: UserNotificationPreferences,
    category: NotificationCategory | None,
    local_time: time,
) -> bool:
    return preference_block(prefs, category, local_time) is None


def is_push_allowed(db: Session, user_id: int, notification_type: str, now: datetime) -> bool:
    if notification_type in TRANSACTIONAL_TYPES:
        return True
    user = db.get(User, user_id)
    local_time = in_zone(now, resolve_timezone(user.timezone if user else None)).time()
    return is_category_allowed(load_preferences(db, user_id), category_of(notification_type), local_time)
