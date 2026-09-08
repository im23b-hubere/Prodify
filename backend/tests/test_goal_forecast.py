from sqlalchemy import select

from app.database import SessionLocal
from app.models import GrowthEvent


from tests.auth_helpers import auth_headers as _auth_headers


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
