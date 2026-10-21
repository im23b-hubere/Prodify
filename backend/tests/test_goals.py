from sqlalchemy import select

from app.database import SessionLocal
from app.models import GrowthEvent, UserGoal
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


def test_current_goal_without_a_saved_row_is_not_configured(client) -> None:
    token = _register(client, "weekly-goal-open@example.com", "weekly-goal-open")
    headers = {"Authorization": f"Bearer {token}"}

    current = client.get("/goals/current", headers=headers)

    assert current.status_code == 200
    assert current.json()["target_value"] == 5
    assert current.json()["configured"] is False
    with SessionLocal() as db:
        assert db.scalar(select(UserGoal).where(UserGoal.goal_type == "weekly_sessions")) is None


def test_saved_goal_reports_configured(client) -> None:
    token = _register(client, "weekly-goal-set@example.com", "weekly-goal-set")
    headers = {"Authorization": f"Bearer {token}"}

    saved = client.post(
        "/goals/set",
        headers=headers,
        json={"goal_type": "weekly_sessions", "target_value": 4},
    )
    current = client.get("/goals/current", headers=headers)

    assert saved.status_code == 200
    assert saved.json()["configured"] is True
    assert current.json()["configured"] is True
    assert current.json()["target_value"] == 4


def test_last_weeks_goal_does_not_configure_this_week(client) -> None:
    token = _register(client, "weekly-goal-old@example.com", "weekly-goal-old")
    headers = {"Authorization": f"Bearer {token}"}
    saved = client.post(
        "/goals/set",
        headers=headers,
        json={"goal_type": "weekly_sessions", "target_value": 4},
    )
    assert saved.status_code == 200

    with SessionLocal() as db:
        goal = db.scalar(select(UserGoal).where(UserGoal.goal_type == "weekly_sessions"))
        assert goal is not None
        goal.week_start = "2000-01-03"
        db.commit()

    current = client.get("/goals/current", headers=headers)

    assert current.status_code == 200
    assert current.json()["configured"] is False
    assert current.json()["target_value"] == 5
    with SessionLocal() as db:
        rows = db.scalars(select(UserGoal).where(UserGoal.goal_type == "weekly_sessions")).all()
        assert len(rows) == 1
        assert rows[0].week_start == "2000-01-03"
        assert rows[0].target_value == 4
