from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest

from app.config import settings
from app.database import SessionLocal
from app.models import ProductionSession, User, UserEngagementProfile
from app.services.engagement.profile import (
    STAGE_COLD_START,
    STAGE_ESTABLISHED,
    STAGE_LEARNING,
    compute_profile,
)
from app.services.engagement.profile_store import behavior_of, load_fresh_profile, refresh_profile
from app.services.session_analytics_service import productivity_hint
from app.services.streak_calendar import StreakCalendar
from tests.auth_helpers import auth_headers

UTC = StreakCalendar(ZoneInfo("UTC"))
ZURICH = StreakCalendar(ZoneInfo("Europe/Zurich"))
NOW = datetime(2026, 6, 10, 12, 0, tzinfo=timezone.utc)  # a Wednesday


def _session(started_at: datetime, minutes: int = 60):
    return SimpleNamespace(started_at=started_at, duration_seconds=minutes * 60)


def _sessions(count: int, *, hour: int = 20, days_apart: int = 1):
    return [_session(NOW.replace(hour=hour) - timedelta(days=1 + index * days_apart)) for index in range(count)]


# --- productivity hint keeps its behaviour ----------------------------------------------------


def test_productivity_hint_needs_ten_sessions():
    assert productivity_hint(_sessions(9), UTC) is None


def test_productivity_hint_names_the_most_common_local_weekday_and_hour():
    rows = _sessions(7, hour=21) + [_session(NOW - timedelta(days=7, hours=-9))] * 3  # three Wednesdays at 21:00

    hint = productivity_hint(rows, UTC)

    assert hint.key == "prod_peak_pattern"
    assert hint.params == {"weekday": 2, "hour": 21}


def test_productivity_hint_breaks_ties_by_first_seen():
    rows = [_session(NOW.replace(hour=hour) - timedelta(days=1)) for hour in (9, 18)] * 5

    assert productivity_hint(rows, UTC).params["hour"] == 9


# --- compute_profile --------------------------------------------------------------------------


def test_a_producer_without_sessions_is_a_cold_start():
    profile = compute_profile([], UTC, NOW)

    assert profile.stage == STAGE_COLD_START
    assert profile.total_sessions == 0
    assert profile.session_hour_histogram == [0] * 24
    assert profile.weekday_histogram == [0] * 7
    assert profile.last_session_at is None
    assert profile.avg_sessions_per_week == 0
    assert profile.avg_session_duration_minutes == 0


def test_one_session_fills_its_local_hour_and_weekday():
    profile = compute_profile([_session(NOW.replace(hour=20) - timedelta(days=1), minutes=45)], UTC, NOW)

    assert profile.session_hour_histogram[20] == 1
    assert profile.weekday_histogram[1] == 1  # Tuesday
    assert profile.avg_session_duration_minutes == 45
    assert profile.last_session_at == NOW.replace(hour=20) - timedelta(days=1)
    assert profile.preferred_hours() == [20]


@pytest.mark.parametrize(
    ("count", "stage"),
    [(3, STAGE_COLD_START), (4, STAGE_LEARNING), (10, STAGE_LEARNING), (11, STAGE_ESTABLISHED)],
)
def test_stage_follows_the_number_of_completed_sessions(count, stage):
    assert compute_profile(_sessions(count), UTC, NOW).stage == stage


def test_the_same_instant_lands_in_the_producers_local_hour():
    session = _session(datetime(2026, 6, 9, 21, 30, tzinfo=timezone.utc))

    assert compute_profile([session], UTC, NOW).session_hour_histogram[21] == 1
    assert compute_profile([session], ZURICH, NOW).session_hour_histogram[23] == 1


def test_recent_activity_compares_this_week_with_the_week_before():
    rows = _sessions(3, days_apart=1) + [_session(NOW - timedelta(days=10))]

    profile = compute_profile(rows, UTC, NOW)

    assert profile.sessions_last_7_days == 3
    assert profile.sessions_previous_7_days == 1


def test_weekly_average_rolls_over_the_last_four_weeks():
    rows = _sessions(8, days_apart=3) + [_session(NOW - timedelta(days=60))]

    assert compute_profile(rows, UTC, NOW).avg_sessions_per_week == 2


def test_a_producer_inactive_for_months_keeps_their_history_but_no_recent_activity():
    rows = [_session(NOW - timedelta(days=120 + index)) for index in range(12)]

    profile = compute_profile(rows, UTC, NOW)

    assert profile.stage == STAGE_ESTABLISHED
    assert profile.sessions_last_7_days == 0
    assert profile.avg_sessions_per_week == 0
    assert profile.days_since_last_session(NOW) == 120


# --- stored profile ---------------------------------------------------------------------------


def _producer(client, name: str) -> tuple[dict[str, str], int]:
    headers = auth_headers(client, f"{name}@example.com", name)
    return headers, client.get("/auth/me", headers=headers).json()["id"]


def _add_session(user_id: int, started_at: datetime, *, minutes: int | None = 30, deleted: bool = False):
    with SessionLocal() as db:
        db.add(
            ProductionSession(
                user_id=user_id,
                started_at=started_at,
                stopped_at=None if minutes is None else started_at + timedelta(minutes=minutes),
                duration_seconds=None if minutes is None else minutes * 60,
                deleted_at=started_at if deleted else None,
            )
        )
        db.commit()


def test_refresh_ignores_deleted_and_running_sessions(client):
    _, user_id = _producer(client, "profiled")
    _add_session(user_id, NOW - timedelta(days=1))
    _add_session(user_id, NOW - timedelta(days=2), deleted=True)
    _add_session(user_id, NOW - timedelta(hours=1), minutes=None)

    with SessionLocal() as db:
        stored = refresh_profile(db, user_id, NOW)
        db.commit()
        assert stored.total_sessions == 1


def test_refresh_stores_one_row_per_producer(client):
    _, user_id = _producer(client, "onerow")

    with SessionLocal() as db:
        refresh_profile(db, user_id, NOW)
        refresh_profile(db, user_id, NOW + timedelta(hours=1))
        db.commit()
        assert db.query(UserEngagementProfile).filter_by(user_id=user_id).count() == 1


def test_refresh_uses_the_producers_timezone(client):
    _, user_id = _producer(client, "zurich")
    with SessionLocal() as db:
        db.get(User, user_id).timezone = "Europe/Zurich"
        db.commit()
    _add_session(user_id, datetime(2026, 6, 9, 21, 30, tzinfo=timezone.utc))

    with SessionLocal() as db:
        stored = refresh_profile(db, user_id, NOW)
        assert behavior_of(stored).session_hour_histogram[23] == 1


def test_a_stale_profile_is_recomputed(client):
    _, user_id = _producer(client, "stale")
    with SessionLocal() as db:
        refresh_profile(db, user_id, NOW - timedelta(days=2))
        db.commit()
    _add_session(user_id, NOW - timedelta(hours=3))

    with SessionLocal() as db:
        assert load_fresh_profile(db, user_id, NOW).total_sessions == 1


def test_a_fresh_profile_is_reused(client):
    _, user_id = _producer(client, "fresh")
    with SessionLocal() as db:
        refresh_profile(db, user_id, NOW - timedelta(minutes=10))
        db.commit()
    _add_session(user_id, NOW - timedelta(hours=3))

    with SessionLocal() as db:
        assert load_fresh_profile(db, user_id, NOW).total_sessions == 0


def test_completing_a_session_refreshes_the_profile(client, monkeypatch):
    monkeypatch.setattr(settings, "push_async_backend", "inline")
    headers, user_id = _producer(client, "finisher")
    session_id = client.post("/sessions/start", headers=headers, json={"session_type": "beat_making"}).json()["id"]

    assert client.post("/sessions/stop", headers=headers, json={"session_id": session_id}).status_code == 200

    with SessionLocal() as db:
        assert db.get(UserEngagementProfile, user_id).total_sessions == 1


def test_deleting_a_producer_removes_their_profile(client):
    headers, user_id = _producer(client, "leaving")
    with SessionLocal() as db:
        refresh_profile(db, user_id, NOW)
        db.commit()

    assert client.delete("/users/me", headers=headers).status_code == 204

    with SessionLocal() as db:
        assert db.get(UserEngagementProfile, user_id) is None
