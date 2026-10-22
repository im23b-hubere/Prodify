from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.database import SessionLocal
from app.models import ProductionSession, utcnow

from tests.auth_helpers import auth_headers

# Wednesday 14:00 in Zurich (CEST, UTC+2).
ZURICH_WEDNESDAY_UTC = datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc)
# Monday 00:30 in Zurich: UTC is still Sunday.
ZURICH_MONDAY_MIDNIGHT_UTC = datetime(2026, 10, 18, 22, 30, tzinfo=timezone.utc)
# Sunday 20:00 in Los Angeles (PDT, UTC-7): UTC is already Monday.
LOS_ANGELES_SUNDAY_EVENING_UTC = datetime(2026, 10, 19, 3, 0, tzinfo=timezone.utc)


def test_week_stats_use_the_zurich_calendar_week_and_its_previous_week(client, monkeypatch):
    headers = auth_headers(client, "stats-week-zurich@example.com", "stats-week-zurich")
    _freeze_clock(monkeypatch, ZURICH_WEDNESDAY_UTC)
    assert client.put(
        "/users/me/timezone", headers=headers, json={"timezone": "Europe/Zurich"}
    ).status_code == 200
    user_id = _user_id(client, headers)
    _store_session(user_id, ZURICH_MONDAY_MIDNIGHT_UTC, 3600)
    _store_session(user_id, datetime(2026, 10, 20, 8, 0, tzinfo=timezone.utc), 60)
    _store_session(user_id, datetime(2026, 10, 18, 10, 0, tzinfo=timezone.utc), 1800)
    _store_session(user_id, datetime(2026, 10, 11, 21, 30, tzinfo=timezone.utc), 7200)

    stats = client.get("/sessions/stats?period=week", headers=headers)
    heatmap = client.get("/stats/heatmap", headers=headers)

    assert stats.status_code == 200
    body = stats.json()
    assert body["summary"]["total_sessions"] == 2
    assert body["summary"]["total_seconds"] == 3660
    assert body["summary"]["hours_delta_vs_prior_period"] == 0.5
    monday = next(point for point in body["trend"] if point["label"] == "2026-10-19")
    assert monday["seconds"] == 3600
    assert monday["sessions"] == 1
    assert all(point["label"] != "2026-10-18" for point in body["trend"])
    heatmap_monday = next(day for day in heatmap.json()["days"] if day["date"] == "2026-10-19")
    assert heatmap_monday["seconds"] == 3600


def test_week_stats_keep_los_angeles_sunday_evening_in_the_local_week(client, monkeypatch):
    headers = auth_headers(client, "stats-week-la@example.com", "stats-week-la")
    _freeze_clock(monkeypatch, LOS_ANGELES_SUNDAY_EVENING_UTC)
    assert client.put(
        "/users/me/timezone", headers=headers, json={"timezone": "America/Los_Angeles"}
    ).status_code == 200
    user_id = _user_id(client, headers)
    _store_session(user_id, LOS_ANGELES_SUNDAY_EVENING_UTC, 300)
    _store_session(user_id, datetime(2026, 10, 19, 15, 0, tzinfo=timezone.utc), 3600)

    stats = client.get("/sessions/stats?period=week", headers=headers)

    assert stats.status_code == 200
    body = stats.json()
    assert body["summary"]["total_sessions"] == 1
    assert body["summary"]["total_seconds"] == 300
    assert [point["label"] for point in body["trend"]] == ["2026-10-18"]


def test_month_stats_stay_a_rolling_thirty_days(client):
    headers = auth_headers(client, "stats-month@example.com", "stats-month")
    user_id = _user_id(client, headers)
    _store_session(user_id, utcnow() - timedelta(days=20), 100)
    _store_session(user_id, utcnow() - timedelta(days=31), 500)

    stats = client.get("/sessions/stats?period=month", headers=headers)

    assert stats.status_code == 200
    body = stats.json()
    assert body["summary"]["total_sessions"] == 1
    assert body["summary"]["total_seconds"] == 100


def _freeze_clock(monkeypatch, moment: datetime) -> None:
    def today_in(zone: ZoneInfo):
        return moment.astimezone(zone).date()

    monkeypatch.setattr("app.services.streak_calendar.today_in", today_in)


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
