from datetime import datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest

from app.services.engagement.limits import (
    MAX_SMART_PER_DAY,
    MIN_SPACING,
    REENGAGEMENT_COOLDOWN,
    LimitReason,
    is_send_allowed,
)
from app.services.engagement.preferences import NotificationCategory, default_preferences

ZURICH = ZoneInfo("Europe/Zurich")


def _local(*args) -> datetime:
    return datetime(*args, tzinfo=ZURICH)


def _sent(at: datetime, kind: str = "friend_nudge"):
    return SimpleNamespace(notification_type=kind, sent_at=at)


def _prefs(quiet: bool = True):
    prefs = default_preferences(user_id=1)
    if not quiet:
        prefs.quiet_start_minute = prefs.quiet_end_minute = 0
    return prefs


def _check(recent, now, *, category=NotificationCategory.SOCIAL, quiet=True):
    return is_send_allowed(recent, now, _prefs(quiet), ZURICH, category=category)


def test_nothing_sent_yet_is_allowed():
    decision = _check([], _local(2026, 6, 10, 18, 0))

    assert decision.allowed
    assert decision.reason == LimitReason.OK


def test_two_smart_notifications_per_local_day_at_most():
    assert MAX_SMART_PER_DAY == 2
    recent = [_sent(_local(2026, 6, 10, 8, 30)), _sent(_local(2026, 6, 10, 14, 45))]

    decision = _check(recent, _local(2026, 6, 10, 21, 0))

    assert not decision.allowed
    assert decision.reason == LimitReason.DAILY_LIMIT


def test_the_daily_limit_resets_at_local_midnight_not_utc():
    recent = [_sent(_local(2026, 6, 10, 8, 30)), _sent(_local(2026, 6, 10, 14, 45))]

    # 01:30 in Zurich is still the previous day in UTC.
    assert _check(recent, _local(2026, 6, 11, 1, 30), quiet=False).allowed


def test_transactional_pushes_do_not_count_toward_the_limits():
    recent = [_sent(_local(2026, 6, 10, 17, 0), "session_complete")] * 3

    assert _check(recent, _local(2026, 6, 10, 18, 0)).allowed


def test_six_hours_between_notifications():
    assert MIN_SPACING == timedelta(hours=6)
    recent = [_sent(_local(2026, 6, 10, 12, 0))]

    blocked = _check(recent, _local(2026, 6, 10, 17, 59))
    allowed = _check(recent, _local(2026, 6, 10, 18, 0))

    assert blocked.reason == LimitReason.MIN_SPACING
    assert allowed.allowed


@pytest.mark.parametrize("local", [_local(2026, 6, 10, 22, 30), _local(2026, 6, 11, 3, 0), _local(2026, 6, 11, 7, 59)])
def test_quiet_hours_across_midnight(local):
    decision = _check([], local)

    assert decision.reason == LimitReason.QUIET_HOURS


def test_streak_reminders_are_not_held_back_by_quiet_hours():
    assert _check([], _local(2026, 6, 10, 23, 15), category=NotificationCategory.STREAK).allowed


def test_disabled_category_reports_its_own_reason():
    prefs = _prefs()
    prefs.rank_enabled = False

    decision = is_send_allowed([], _local(2026, 6, 10, 18, 0), prefs, ZURICH, category=NotificationCategory.RANK)

    assert decision.reason == LimitReason.CATEGORY_DISABLED


def test_master_toggle_off_reports_smart_disabled():
    prefs = _prefs()
    prefs.smart_enabled = False

    decision = is_send_allowed([], _local(2026, 6, 10, 18, 0), prefs, ZURICH, category=NotificationCategory.SOCIAL)

    assert decision.reason == LimitReason.SMART_DISABLED


def test_reengagement_waits_three_days_after_the_last_one():
    assert REENGAGEMENT_COOLDOWN == timedelta(days=3)
    recent = [_sent(_local(2026, 6, 10, 18, 0), "reengagement")]

    next_day = _check(recent, _local(2026, 6, 11, 18, 0), category=NotificationCategory.REENGAGEMENT)
    three_days_later = _check(recent, _local(2026, 6, 13, 18, 0), category=NotificationCategory.REENGAGEMENT)
    other_category = _check(recent, _local(2026, 6, 11, 18, 0), category=NotificationCategory.SOCIAL)

    assert next_day.reason == LimitReason.REENGAGEMENT_COOLDOWN
    assert three_days_later.allowed
    assert other_category.allowed


def test_daily_limit_on_the_25_hour_day_when_clocks_go_back():
    # 2026-10-25: Zurich falls back from 03:00 CEST to 02:00 CET.
    recent = [_sent(_local(2026, 10, 25, 1, 0)), _sent(_local(2026, 10, 25, 9, 0))]

    late_same_day = _check(recent, _local(2026, 10, 25, 23, 30), quiet=False)
    next_day = _check(recent, _local(2026, 10, 26, 0, 30), quiet=False)

    assert late_same_day.reason == LimitReason.DAILY_LIMIT
    assert next_day.allowed


def test_daily_limit_on_the_23_hour_day_when_clocks_go_forward():
    # 2026-03-29: Zurich springs forward from 02:00 CET to 03:00 CEST.
    recent = [_sent(_local(2026, 3, 29, 0, 30)), _sent(_local(2026, 3, 29, 8, 0))]

    late_same_day = _check(recent, _local(2026, 3, 29, 23, 30), quiet=False)
    next_day = _check(recent, _local(2026, 3, 30, 0, 30), quiet=False)

    assert late_same_day.reason == LimitReason.DAILY_LIMIT
    assert next_day.allowed


def test_naive_timestamps_from_the_database_are_read_as_utc():
    # SQLite hands back naive UTC: 21:30 there is 23:30 in Zurich, five and a half hours before 05:00.
    naive_utc = _local(2026, 6, 10, 23, 30).astimezone(ZoneInfo("UTC")).replace(tzinfo=None)

    decision = _check([_sent(naive_utc)], _local(2026, 6, 11, 5, 0), quiet=False)

    assert decision.reason == LimitReason.MIN_SPACING


def test_a_push_that_never_arrived_does_not_use_up_the_daily_limit():
    failed = SimpleNamespace(
        notification_type="reengagement",
        sent_at=_local(2026, 6, 10, 12, 0),
        delivered_count=0,
    )

    decision = _check([failed, failed], _local(2026, 6, 10, 12, 30), category=NotificationCategory.REENGAGEMENT)

    assert decision.allowed
