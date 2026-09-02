from datetime import date

from app.streakutil import build_calendar_weeks, last_7_day_states, monday_of


def test_monday_of_calendar_week() -> None:
    assert monday_of(date(2026, 9, 2)) == date(2026, 8, 31)
    assert monday_of(date(2026, 8, 31)) == date(2026, 8, 31)
    assert monday_of(date(2026, 9, 6)) == date(2026, 8, 31)


def test_build_calendar_weeks_is_monday_sunday_oldest_first() -> None:
    weeks = build_calendar_weeks(
        ["2026-08-31", "2026-09-02"],
        ["2026-08-24"],
        today=date(2026, 9, 2),
    )

    assert len(weeks) == 4
    assert [week["offset"] for week in weeks] == [-3, -2, -1, 0]

    current = weeks[-1]
    assert current["week_start"] == "2026-08-31"
    days = current["days"]
    assert [day["date"] for day in days] == [
        "2026-08-31",
        "2026-09-01",
        "2026-09-02",
        "2026-09-03",
        "2026-09-04",
        "2026-09-05",
        "2026-09-06",
    ]
    assert days[0]["state"] == "session"
    assert days[0]["label"] == "Mo"
    assert days[2]["state"] == "session"
    assert days[2]["is_today"] is True
    assert days[2]["is_future"] is False
    assert all(not day["is_today"] for day in days if day["date"] != "2026-09-02")
    assert [day["is_future"] for day in days] == [False, False, False, True, True, True, True]

    last_week = weeks[-2]
    assert last_week["week_start"] == "2026-08-24"
    assert last_week["offset"] == -1
    assert last_week["days"][0]["state"] == "freeze"
    assert all(not day["is_today"] and not day["is_future"] for day in last_week["days"])


def test_last_7_day_states_match_current_calendar_week() -> None:
    states, labels = last_7_day_states(
        ["2026-09-02"],
        [],
        today=date(2026, 9, 2),
    )

    assert states == ["none", "none", "session", "none", "none", "none", "none"]
    assert labels == ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
