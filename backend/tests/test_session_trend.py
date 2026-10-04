from datetime import datetime, timezone
from types import SimpleNamespace

from app.services.session_analytics_service import session_trend
from app.services.stats_period import StatsPeriod
from app.services.streak_calendar import UTC_CALENDAR


def _session(day: str, seconds: int) -> SimpleNamespace:
    return SimpleNamespace(
        started_at=datetime.fromisoformat(day).replace(tzinfo=timezone.utc),
        duration_seconds=seconds,
    )


def test_week_trend_keeps_one_bar_per_day_with_hours_as_seconds():
    monday = _session("2026-01-05", 3600)
    also_monday = _session("2026-01-05T18:00:00", 1800)
    wednesday = _session("2026-01-07", 7200)

    points = session_trend([monday, also_monday, wednesday], UTC_CALENDAR, StatsPeriod.parse("week"))

    assert [(point.label, point.sessions, point.seconds) for point in points] == [
        ("2026-01-05", 2, 5400),
        ("2026-01-07", 1, 7200),
    ]


def test_lifetime_trend_folds_days_into_week_starts_so_the_chart_stays_readable():
    week_one = _session("2026-01-05", 3600)
    same_week = _session("2026-01-07", 1800)
    next_week = _session("2026-01-12", 7200)

    points = session_trend([week_one, same_week, next_week], UTC_CALENDAR, StatsPeriod.parse("all"))

    assert [(point.label, point.sessions, point.seconds) for point in points] == [
        ("2026-01-05", 2, 5400),
        ("2026-01-12", 1, 7200),
    ]
