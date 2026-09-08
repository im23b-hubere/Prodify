"""Streak day boundaries follow the user's IANA timezone, and reads never write."""

from datetime import date, datetime, timezone

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Streak, User
from app.services.streak_calendar import StreakCalendar, calendar_for
from app.streakutil import compute_current_streak
from app.timeutil import DEFAULT_TIMEZONE, is_supported_timezone, resolve_timezone


def _auth_headers(client, email: str, username: str) -> dict[str, str]:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": "strong-pass-123"},
    )
    assert register.status_code == 201, register.text
    return {"Authorization": f"Bearer {register.json()['access_token']}"}


def _user_id(client, headers: dict[str, str]) -> int:
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    return me.json()["id"]


def _calendar(timezone_name: str | None) -> StreakCalendar:
    return calendar_for(
        User(id=1, email="tz@example.com", username="tz", hashed_password="x", timezone=timezone_name)
    )


def test_evening_utc_session_belongs_to_the_next_day_in_new_zealand() -> None:
    evening_utc = datetime(2026, 9, 8, 22, 30, tzinfo=timezone.utc)

    assert _calendar(None).day_key_of(evening_utc) == "2026-09-08"
    assert _calendar("Pacific/Auckland").day_key_of(evening_utc) == "2026-09-09"


def test_morning_utc_session_still_belongs_to_the_previous_day_in_hawaii() -> None:
    early_utc = datetime(2026, 9, 8, 5, 15, tzinfo=timezone.utc)

    assert _calendar(None).day_key_of(early_utc) == "2026-09-08"
    assert _calendar("Pacific/Honolulu").day_key_of(early_utc) == "2026-09-07"


def test_day_boundary_follows_daylight_saving_changes() -> None:
    berlin = _calendar("Europe/Berlin")

    # Same wall-clock offset from midnight UTC, but Berlin is UTC+2 in July and UTC+1 in January.
    assert berlin.day_key_of(datetime(2026, 7, 15, 22, 30, tzinfo=timezone.utc)) == "2026-07-16"
    assert berlin.day_key_of(datetime(2026, 1, 15, 22, 30, tzinfo=timezone.utc)) == "2026-01-15"


def test_naive_timestamps_from_sqlite_are_read_as_utc() -> None:
    naive_evening = datetime(2026, 9, 8, 22, 30)

    assert _calendar("Pacific/Auckland").day_key_of(naive_evening) == "2026-09-09"


def test_unknown_timezone_falls_back_to_utc_instead_of_failing() -> None:
    assert not is_supported_timezone("Mars/Olympus_Mons")
    assert resolve_timezone("Mars/Olympus_Mons") == resolve_timezone(DEFAULT_TIMEZONE)
    assert _calendar("Mars/Olympus_Mons").day_key_of(
        datetime(2026, 9, 8, 22, 30, tzinfo=timezone.utc)
    ) == "2026-09-08"


def test_current_streak_counts_days_ending_at_the_callers_today() -> None:
    days = ["2026-09-06", "2026-09-07", "2026-09-08"]

    assert compute_current_streak(days, date(2026, 9, 8)) == 3
    assert compute_current_streak(days, date(2026, 9, 9)) == 3
    assert compute_current_streak(days, date(2026, 9, 10)) == 0


def test_week_start_key_is_the_local_monday() -> None:
    berlin = _calendar("Europe/Berlin")

    assert berlin.week_start_key_of(datetime(2026, 9, 6, 23, 30, tzinfo=timezone.utc)) == "2026-09-07"


def test_timezone_endpoint_stores_a_valid_iana_zone(client) -> None:
    headers = _auth_headers(client, "tz-set@example.com", "tz-set-user")

    response = client.put("/users/me/timezone", headers=headers, json={"timezone": "Europe/Berlin"})

    assert response.status_code == 200
    assert response.json() == {"timezone": "Europe/Berlin"}
    with SessionLocal() as db:
        assert db.get(User, _user_id(client, headers)).timezone == "Europe/Berlin"


def test_timezone_endpoint_rejects_an_unknown_zone(client) -> None:
    headers = _auth_headers(client, "tz-bad@example.com", "tz-bad-user")

    response = client.put("/users/me/timezone", headers=headers, json={"timezone": "Europe/Berlin "})
    garbage = client.put("/users/me/timezone", headers=headers, json={"timezone": "Not/AZone"})

    # A trailing space is trimmed and accepted; an unknown identifier is refused outright.
    assert response.status_code == 200
    assert garbage.status_code == 422
    with SessionLocal() as db:
        assert db.get(User, _user_id(client, headers)).timezone == "Europe/Berlin"


def _store_stale_streak(user_id: int, value: int) -> None:
    with SessionLocal() as db:
        streak = db.scalar(select(Streak).where(Streak.user_id == user_id))
        streak.current_streak = value
        db.commit()


def _stored_current_streak(user_id: int) -> int:
    with SessionLocal() as db:
        return db.scalar(select(Streak).where(Streak.user_id == user_id)).current_streak


def test_streak_reads_report_fresh_numbers_without_writing_them_back(client) -> None:
    headers = _auth_headers(client, "tz-read@example.com", "tz-read-user")
    user_id = _user_id(client, headers)
    _store_stale_streak(user_id, 99)

    overview = client.get("/streak/overview", headers=headers)
    assert client.get("/streak/history", headers=headers).status_code == 200
    assert client.get("/streak/milestones", headers=headers).status_code == 200

    # The user has no sessions, so the truthful answer is 0 — but a GET must not persist it.
    assert overview.json()["current_streak"] == 0
    assert _stored_current_streak(user_id) == 99


def test_reconcile_endpoint_is_what_persists_the_streak_row(client) -> None:
    headers = _auth_headers(client, "tz-write@example.com", "tz-write-user")
    user_id = _user_id(client, headers)
    _store_stale_streak(user_id, 99)

    assert client.post("/streak/reconcile", headers=headers).status_code == 204

    assert _stored_current_streak(user_id) == 0


def test_overview_reports_a_session_completed_today_in_the_users_timezone(client) -> None:
    headers = _auth_headers(client, "tz-flow@example.com", "tz-flow-user")
    assert client.put(
        "/users/me/timezone", headers=headers, json={"timezone": "Pacific/Auckland"}
    ).status_code == 200

    started = client.post("/sessions/start", headers=headers, json={"session_type": "beat_making"})
    assert started.status_code == 201
    stopped = client.post(
        "/sessions/stop", headers=headers, json={"session_id": started.json()["id"]}
    )
    assert stopped.status_code == 200

    body = client.get("/streak/overview", headers=headers).json()
    today = next(day for week in body["calendar_weeks"] for day in week["days"] if day["is_today"])

    assert body["current_streak"] == 1
    assert body["streak_at_risk"] is False
    assert today["state"] == "session"
