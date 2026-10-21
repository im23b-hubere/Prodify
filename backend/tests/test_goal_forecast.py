from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.database import SessionLocal
from app.models import GrowthEvent, ProductionSession, UserGoal


from tests.auth_helpers import auth_headers as _auth_headers

# Monday 00:30 in Zurich (CEST, UTC+2): UTC is still Sunday.
ZURICH_MONDAY_MIDNIGHT_UTC = datetime(2026, 10, 18, 22, 30, tzinfo=timezone.utc)
# Sunday 20:00 in Los Angeles (PDT, UTC-7): UTC is already Monday.
LOS_ANGELES_SUNDAY_EVENING_UTC = datetime(2026, 10, 19, 3, 0, tzinfo=timezone.utc)


def test_goal_forecast_endpoint(client):
    headers = _auth_headers(client, "forecast@example.com", "forecast-user")
    set_goal = client.post("/goals/set", headers=headers, json={"goal_type": "weekly_sessions", "target_value": 4})
    assert set_goal.status_code == 200

    sync = client.post(
        "/billing/sync",
        headers=headers,
        json={"app_user_id": "1", "entitlement": "premium", "trial_active": False, "expires_at": None},
    )
    assert sync.status_code == 200

    forecast = client.get("/outcomes/goal-forecast/current", headers=headers)
    assert forecast.status_code == 200
    body = forecast.json()
    assert body["target_sessions"] == 4
    assert body["risk_level"] in {"on_track", "at_risk", "off_track"}

    repeated = client.get("/outcomes/goal-forecast/current", headers=headers)
    assert repeated.status_code == 200
    with SessionLocal() as db:
        events = db.scalars(
            select(GrowthEvent).where(
                GrowthEvent.user_id == 1,
                GrowthEvent.event_name == "goal_forecast_seen",
            )
        ).all()
        assert len(events) == 1


def test_forecast_uses_the_weekly_goal_default_when_none_is_saved(client):
    headers = _auth_headers(client, "forecast-default@example.com", "forecast-default")

    goal = client.get("/goals/current", headers=headers)
    forecast = client.get("/outcomes/goal-forecast/current", headers=headers)

    assert goal.status_code == 200
    assert forecast.status_code == 200
    assert forecast.json()["target_sessions"] == 5
    assert forecast.json()["target_sessions"] == goal.json()["target_value"]
    assert forecast.json()["week_start"] == goal.json()["week_start"]
    assert forecast.json()["completed_sessions"] == goal.json()["current_sessions"]
    with SessionLocal() as db:
        saved_goals = db.scalars(
            select(UserGoal).where(UserGoal.user_id == _user_id(client, headers))
        ).all()
    assert saved_goals == []


def test_forecast_counts_zurich_monday_midnight_in_the_new_local_week(client, monkeypatch):
    headers = _auth_headers(client, "forecast-zurich@example.com", "forecast-zurich")
    _freeze_clock(monkeypatch, ZURICH_MONDAY_MIDNIGHT_UTC)
    assert client.put(
        "/users/me/timezone", headers=headers, json={"timezone": "Europe/Zurich"}
    ).status_code == 200
    saved = client.post(
        "/goals/set",
        headers=headers,
        json={"goal_type": "weekly_sessions", "target_value": 6},
    )
    assert saved.status_code == 200
    _store_completed_session(_user_id(client, headers), ZURICH_MONDAY_MIDNIGHT_UTC)

    goal = client.get("/goals/current", headers=headers).json()
    forecast = client.get("/outcomes/goal-forecast/current", headers=headers).json()

    assert goal["week_start"] == "2026-10-19"
    assert forecast["week_start"] == "2026-10-19"
    assert forecast["target_sessions"] == 6
    assert forecast["completed_sessions"] == 1
    assert goal["current_sessions"] == 1
    assert forecast["days_left"] == 6


def test_forecast_keeps_los_angeles_sunday_evening_in_the_local_week(client, monkeypatch):
    headers = _auth_headers(client, "forecast-la@example.com", "forecast-la")
    _freeze_clock(monkeypatch, LOS_ANGELES_SUNDAY_EVENING_UTC)
    assert client.put(
        "/users/me/timezone", headers=headers, json={"timezone": "America/Los_Angeles"}
    ).status_code == 200
    saved = client.post(
        "/goals/set",
        headers=headers,
        json={"goal_type": "weekly_sessions", "target_value": 3},
    )
    assert saved.status_code == 200
    _store_completed_session(_user_id(client, headers), LOS_ANGELES_SUNDAY_EVENING_UTC)

    goal = client.get("/goals/current", headers=headers).json()
    forecast = client.get("/outcomes/goal-forecast/current", headers=headers).json()

    assert goal["week_start"] == "2026-10-12"
    assert forecast["week_start"] == "2026-10-12"
    assert forecast["target_sessions"] == 3
    assert forecast["completed_sessions"] == 1
    assert goal["current_sessions"] == 1
    assert forecast["days_left"] == 0


def _freeze_clock(monkeypatch, moment: datetime) -> None:
    def today_in(zone: ZoneInfo):
        return moment.astimezone(zone).date()

    monkeypatch.setattr("app.services.streak_calendar.today_in", today_in)


def _user_id(client, headers: dict[str, str]) -> int:
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    return me.json()["id"]


def _store_completed_session(user_id: int, started_at: datetime) -> None:
    with SessionLocal() as db:
        db.add(
            ProductionSession(
                user_id=user_id,
                started_at=started_at,
                stopped_at=started_at + timedelta(minutes=30),
                duration_seconds=1800,
                session_type="beat_making",
            )
        )
        db.commit()
