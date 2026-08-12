from sqlalchemy import select

from app.database import SessionLocal
from app.models import GrowthEvent
from tests.test_friends import _register


def test_set_goal_persists_snapshot_and_tracking_event(client) -> None:
    token = _register(client, "weekly-goal@example.com", "weekly-goal-user")
    headers = {"Authorization": f"Bearer {token}"}

    saved = client.post(
        "/goals/set",
        headers=headers,
        json={"goal_type": "weekly_sessions", "target_value": 4},
    )
    current = client.get("/goals/current", headers=headers)

    assert saved.status_code == 200
    assert saved.json()["target_value"] == 4
    assert current.status_code == 200
    assert current.json()["target_value"] == 4
    with SessionLocal() as db:
        event = db.scalar(
            select(GrowthEvent).where(GrowthEvent.event_name == "weekly_goal_set")
        )
        assert event is not None
