from datetime import datetime, timezone
from types import SimpleNamespace

from app.services.stats_service import _most_hours_day_record
from app.services.streak_calendar import UTC_CALENDAR


def _session(day: str, seconds: int) -> SimpleNamespace:
    return SimpleNamespace(
        started_at=datetime.fromisoformat(day).replace(tzinfo=timezone.utc),
        duration_seconds=seconds,
    )


def test_busiest_day_is_hours_not_session_count():
    three_short = [
        _session("2026-01-05", 600),
        _session("2026-01-05", 600),
        _session("2026-01-05", 600),
    ]
    one_long = [_session("2026-01-07", 7200)]

    record = _most_hours_day_record(three_short + one_long, UTC_CALENDAR)

    assert record is not None
    assert record.key == "most_hours_day"
    assert record.occurred_at == "2026-01-07"
    assert record.context == "2026-01-07"
    assert record.value == "2h 0m"
    assert "session" not in record.value.lower()


def test_tied_hours_keep_the_most_recent_day():
    record = _most_hours_day_record(
        [_session("2026-01-05", 3600), _session("2026-01-08", 3600)],
        UTC_CALENDAR,
    )

    assert record is not None
    assert record.occurred_at == "2026-01-08"
    assert record.value == "1h 0m"


def test_most_hours_day_is_absent_without_sessions():
    assert _most_hours_day_record([], UTC_CALENDAR) is None
