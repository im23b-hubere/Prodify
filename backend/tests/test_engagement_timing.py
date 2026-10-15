from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.services.engagement.profile import (
    STAGE_COLD_START,
    STAGE_ESTABLISHED,
    STAGE_LEARNING,
    BehaviorProfile,
)
from app.services.engagement.timing import (
    DEFAULT_WINDOW,
    NOTIFY_LEAD,
    is_send_moment,
    production_window,
    send_time_on,
)

ZURICH = ZoneInfo("Europe/Zurich")


def _profile(stage: int, hours: dict[int, int], weekdays: dict[int, int] | None = None) -> BehaviorProfile:
    return BehaviorProfile(
        total_sessions=sum(hours.values()),
        stage=stage,
        session_hour_histogram=[hours.get(hour, 0) for hour in range(24)],
        weekday_histogram=[(weekdays or {}).get(day, 0) for day in range(7)],
        avg_sessions_per_week=0,
        avg_session_duration_minutes=0,
        last_session_at=None,
        sessions_last_7_days=0,
        sessions_previous_7_days=0,
    )


def test_a_cold_start_producer_gets_the_default_evening_window():
    window = production_window(_profile(STAGE_COLD_START, {9: 2}))

    assert window == DEFAULT_WINDOW
    assert (window.start_hour, window.end_hour) == (17, 21)
    assert window.weekdays == tuple(range(7))


def test_the_window_is_the_busiest_block_of_consecutive_hours():
    window = production_window(_profile(STAGE_LEARNING, {10: 1, 19: 2, 20: 3, 21: 2, 23: 1}))

    assert (window.start_hour, window.end_hour) == (19, 22)
    assert not window.is_default


def test_the_window_does_not_start_in_an_empty_hour():
    window = production_window(_profile(STAGE_LEARNING, {20: 4, 21: 1}))

    assert (window.start_hour, window.end_hour) == (20, 22)


def test_a_late_night_block_can_run_past_midnight():
    window = production_window(_profile(STAGE_LEARNING, {23: 3, 0: 3, 1: 2}))

    assert (window.start_hour, window.end_hour) == (23, 2)


def test_learning_producers_keep_every_weekday():
    window = production_window(_profile(STAGE_LEARNING, {20: 5}, {0: 5}))

    assert window.weekdays == tuple(range(7))


def test_established_producers_get_their_three_strongest_weekdays():
    window = production_window(_profile(STAGE_ESTABLISHED, {20: 12}, {0: 1, 1: 4, 3: 4, 5: 2, 6: 1}))

    assert window.weekdays == (1, 3, 5)


def test_the_send_time_is_shortly_before_the_window_opens_in_local_time():
    send_at = send_time_on(DEFAULT_WINDOW, date(2026, 6, 10), ZURICH)

    assert send_at == datetime(2026, 6, 10, 17, 0, tzinfo=ZURICH) - NOTIFY_LEAD
    assert send_at.utcoffset() == timedelta(hours=2)


def test_the_send_time_keeps_local_wall_clock_across_daylight_saving():
    winter = send_time_on(DEFAULT_WINDOW, date(2026, 3, 28), ZURICH)
    summer = send_time_on(DEFAULT_WINDOW, date(2026, 3, 29), ZURICH)

    assert (winter.hour, winter.minute) == (summer.hour, summer.minute)
    assert winter.utcoffset() != summer.utcoffset()


def test_a_send_moment_is_the_slot_starting_at_the_send_time():
    send_at = send_time_on(DEFAULT_WINDOW, date(2026, 6, 10), ZURICH)

    assert is_send_moment(DEFAULT_WINDOW, send_at, ZURICH)
    assert is_send_moment(DEFAULT_WINDOW, send_at + timedelta(minutes=29), ZURICH)
    assert not is_send_moment(DEFAULT_WINDOW, send_at - timedelta(minutes=1), ZURICH)
    assert not is_send_moment(DEFAULT_WINDOW, send_at + timedelta(minutes=30), ZURICH)


def test_no_send_moment_on_a_weekday_outside_the_window():
    window = production_window(_profile(STAGE_ESTABLISHED, {20: 12}, {0: 4, 1: 4, 2: 4}))
    thursday = send_time_on(window, date(2026, 6, 11), ZURICH)

    assert not is_send_moment(window, thursday, ZURICH)


def test_a_window_starting_at_midnight_sends_the_evening_before():
    window = production_window(_profile(STAGE_LEARNING, {0: 3, 1: 2}))

    send_at = send_time_on(window, date(2026, 6, 10), ZURICH)

    assert send_at == datetime(2026, 6, 9, 23, 35, tzinfo=ZURICH)
