"""A weekly goal counts the same sessions that light a studio day: five minutes of work."""

from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import ProductionSession

from tests.auth_helpers import auth_headers


WEDNESDAY = datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc)
FOUR_MINUTES_59 = 299
FIVE_MINUTES = 300
THREE_MINUTES = 180


def test_four_fifty_nine_does_not_count_and_five_minutes_does(client, monkeypatch):
    _freeze_today(monkeypatch, WEDNESDAY)
    headers = auth_headers(client, "counted-floor@example.com", "counted-floor")
    assert client.put(
        "/users/me/timezone", headers=headers, json={"timezone": "Europe/Zurich"}
    ).status_code == 200
    assert client.post(
        "/goals/set",
        headers=headers,
        json={"goal_type": "weekly_sessions", "target_value": 4},
    ).status_code == 200
    user_id = _user_id(client, headers)
    # 12:00 in Zurich on Tuesday.
    _store_session(user_id, datetime(2026, 10, 20, 10, 0, tzinfo=timezone.utc), FOUR_MINUTES_59)
    # 01:30 in Zurich on Wednesday, still Tuesday in UTC.
    long_id = _store_session(
        user_id, datetime(2026, 10, 20, 23, 30, tzinfo=timezone.utc), FIVE_MINUTES
    )

    goal = client.get("/goals/current", headers=headers).json()
    forecast = client.get("/outcomes/goal-forecast/current", headers=headers).json()
    insights = client.get("/stats/insights", headers=headers).json()
    days = {day["date"]: day for day in client.get("/stats/heatmap", headers=headers).json()["days"]}
    impact = _goal_impact(client, headers, long_id)

    assert goal["current_sessions"] == 1
    assert forecast["completed_sessions"] == 1
    assert insights["weekly_goal_sessions"] == 1
    assert days["2026-10-20"]["seconds"] == FOUR_MINUTES_59
    assert days["2026-10-20"]["counted"] is False
    assert days["2026-10-21"]["seconds"] == FIVE_MINUTES
    assert days["2026-10-21"]["counted"] is True
    assert impact == {"count": 1, "target": 4}


def test_two_short_sessions_on_one_day_count_as_neither_goal_nor_studio_day(client, monkeypatch):
    _freeze_today(monkeypatch, WEDNESDAY)
    headers = auth_headers(client, "counted-sum@example.com", "counted-sum")
    assert client.post(
        "/goals/set",
        headers=headers,
        json={"goal_type": "weekly_sessions", "target_value": 4},
    ).status_code == 200
    user_id = _user_id(client, headers)
    started = datetime(2026, 10, 21, 10, 0, tzinfo=timezone.utc)
    _store_session(user_id, started, THREE_MINUTES)
    _store_session(user_id, started + timedelta(hours=1), THREE_MINUTES)

    goal = client.get("/goals/current", headers=headers).json()
    days = {day["date"]: day for day in client.get("/stats/heatmap", headers=headers).json()["days"]}

    assert goal["current_sessions"] == 0
    assert days["2026-10-21"]["seconds"] == THREE_MINUTES * 2
    assert days["2026-10-21"]["counted"] is False


def _freeze_today(monkeypatch, moment: datetime) -> None:
    monkeypatch.setattr(
        "app.services.streak_calendar.today_in",
        lambda zone: moment.astimezone(zone).date(),
    )


def _user_id(client, headers: dict[str, str]) -> int:
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    return me.json()["id"]


def _store_session(user_id: int, started_at: datetime, duration_seconds: int) -> int:
    with SessionLocal() as db:
        session = ProductionSession(
            user_id=user_id,
            started_at=started_at,
            stopped_at=started_at + timedelta(seconds=duration_seconds),
            duration_seconds=duration_seconds,
            session_type="beat_making",
        )
        db.add(session)
        db.commit()
        return session.id


def _goal_impact(client, headers: dict[str, str], session_id: int) -> dict:
    body = client.get(f"/sessions/item/{session_id}/insights", headers=headers)
    assert body.status_code == 200, body.text
    items = [item for item in body.json()["impact_items"] if item["key"] == "impact_week_progress"]
    assert len(items) == 1
    return items[0]["params"]
