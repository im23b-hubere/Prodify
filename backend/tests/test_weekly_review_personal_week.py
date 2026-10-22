from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.database import SessionLocal
from app.models import ProductionSession

from tests.auth_helpers import auth_headers

# Sunday 20:00 in Los Angeles (PDT, UTC-7): UTC is already Monday 2026-10-19.
LOS_ANGELES_SUNDAY_EVENING_UTC = datetime(2026, 10, 19, 3, 0, tzinfo=timezone.utc)
# Monday 00:30 in Zurich (CEST, UTC+2): UTC is still Sunday 2026-10-18.
ZURICH_MONDAY_MIDNIGHT_UTC = datetime(2026, 10, 18, 22, 30, tzinfo=timezone.utc)
# A Monday that is not the UTC week of the day these tests run.
FROZEN_UTC_MONDAY = datetime(2026, 11, 2, 15, 0, tzinfo=timezone.utc)


def test_review_on_los_angeles_sunday_evening_uses_the_local_week(client, monkeypatch):
    headers = auth_headers(client, "review-la@example.com", "review-la")
    _freeze_clock(monkeypatch, LOS_ANGELES_SUNDAY_EVENING_UTC)
    _silence_coach(monkeypatch)
    assert client.put(
        "/users/me/timezone", headers=headers, json={"timezone": "America/Los_Angeles"}
    ).status_code == 200
    assert client.post(
        "/goals/set",
        headers=headers,
        json={"goal_type": "weekly_sessions", "target_value": 3},
    ).status_code == 200
    user_id = _user_id(client, headers)
    _store_session(user_id, LOS_ANGELES_SUNDAY_EVENING_UTC, 300)
    _store_session(user_id, LOS_ANGELES_SUNDAY_EVENING_UTC, 299)
    _store_session(user_id, datetime(2026, 10, 19, 15, 0, tzinfo=timezone.utc), 300)

    review = client.post("/outcomes/weekly-review/generate", headers=headers)
    goal = client.get("/goals/current", headers=headers)
    current = client.get("/outcomes/weekly-review/current", headers=headers)

    assert review.status_code == 200
    body = review.json()
    assert body["week_start"] == "2026-10-12"
    assert body["week_end"] == "2026-10-18"
    assert body["total_sessions"] == 1
    assert body["total_seconds"] == 300
    assert body["total_sessions"] == goal.json()["current_sessions"]
    assert "You performed best around 20:00." in body["insights"]
    assert "Your strongest output day was weekday #7." in body["insights"]
    assert "You skipped 2 planned session(s)." in body["blockers"]
    assert current.status_code == 200
    assert current.json()["week_start"] == "2026-10-12"
    assert current.json()["total_sessions"] == 1


def test_review_counts_zurich_monday_midnight_in_the_new_local_week(client, monkeypatch):
    headers = auth_headers(client, "review-zurich@example.com", "review-zurich")
    _freeze_clock(monkeypatch, ZURICH_MONDAY_MIDNIGHT_UTC)
    _silence_coach(monkeypatch)
    assert client.put(
        "/users/me/timezone", headers=headers, json={"timezone": "Europe/Zurich"}
    ).status_code == 200
    user_id = _user_id(client, headers)
    _store_session(user_id, ZURICH_MONDAY_MIDNIGHT_UTC, 300)
    _store_session(user_id, datetime(2026, 10, 18, 10, 0, tzinfo=timezone.utc), 1800)

    review = client.post("/outcomes/weekly-review/generate", headers=headers)
    goal = client.get("/goals/current", headers=headers)

    assert review.status_code == 200
    body = review.json()
    assert body["week_start"] == "2026-10-19"
    assert body["week_end"] == "2026-10-25"
    assert body["total_sessions"] == 1
    assert body["total_seconds"] == 300
    assert body["total_sessions"] == goal.json()["current_sessions"]
    assert "You performed best around 00:00." in body["insights"]


def test_review_for_a_utc_user_follows_the_frozen_utc_monday(client, monkeypatch):
    headers = auth_headers(client, "review-utc@example.com", "review-utc")
    _freeze_clock(monkeypatch, FROZEN_UTC_MONDAY)
    _silence_coach(monkeypatch)
    user_id = _user_id(client, headers)
    _store_session(user_id, FROZEN_UTC_MONDAY, 300)
    _store_session(user_id, datetime(2026, 10, 21, 15, 0, tzinfo=timezone.utc), 600)

    review = client.post("/outcomes/weekly-review/generate", headers=headers)

    assert review.status_code == 200
    body = review.json()
    assert body["week_start"] == "2026-11-02"
    assert body["week_end"] == "2026-11-08"
    assert body["total_sessions"] == 1
    assert body["total_seconds"] == 300
    assert "You performed best around 15:00." in body["insights"]


def _freeze_clock(monkeypatch, moment: datetime) -> None:
    def today_in(zone: ZoneInfo):
        return moment.astimezone(zone).date()

    monkeypatch.setattr("app.services.streak_calendar.today_in", today_in)


def _silence_coach(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.weekly_review_service.generate_weekly_coach_note",
        lambda _prompt: "Protect the hour that already works.",
    )


def _user_id(client, headers: dict[str, str]) -> int:
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    return me.json()["id"]


def _store_session(user_id: int, started_at: datetime, duration_seconds: int) -> None:
    with SessionLocal() as db:
        db.add(
            ProductionSession(
                user_id=user_id,
                started_at=started_at,
                stopped_at=started_at + timedelta(seconds=duration_seconds),
                duration_seconds=duration_seconds,
                session_type="beat_making",
            )
        )
        db.commit()
