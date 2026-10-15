"""
Names of the behaviour events the engine learns from, recorded through `kpi_tracker.track_event`.

They share the `growth_events` log with product analytics, so names follow its snake_case
convention, and events that already existed keep their original names (`streak_broken`).
"""

from enum import StrEnum


class EngagementEvent(StrEnum):
    APP_OPENED = "app_opened"

    SESSION_STARTED = "session_started"
    SESSION_COMPLETED = "session_completed"

    STREAK_EXTENDED = "streak_extended"
    STREAK_LOST = "streak_broken"

    CHALLENGE_JOINED = "challenge_joined"

    FRIEND_ADDED = "friend_added"

    RANK_UP = "rank_up"

    NOTIFICATION_SENT = "notification_sent"
    NOTIFICATION_OPENED = "notification_opened"
    SESSION_STARTED_AFTER_NOTIFICATION = "session_started_after_notification"
    NOTIFICATIONS_DISABLED = "notifications_disabled"
