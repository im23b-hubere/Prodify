from datetime import timedelta

from sqlalchemy import select

from app.database import SessionLocal
from app.models import GrowthEvent, WeeklyChallenge, utcnow
from tests.test_friends import _register


def _week_start() -> str:
    today = utcnow().date()
    return (today - timedelta(days=today.weekday())).isoformat()


def test_weekly_challenge_workflow_persists_goal_checkin_join_and_events(client) -> None:
    token = _register(client, "weekly-challenge@example.com", "weekly-challenge-user")
    headers = {"Authorization": f"Bearer {token}"}
    with SessionLocal() as db:
        challenge = WeeklyChallenge(
            week_start=_week_start(),
            challenge_type="weekly_sessions",
            status="active",
            config_json="{}",
        )
        db.add(challenge)
        db.commit()
        db.refresh(challenge)
        challenge_id = challenge.id

    first_goal = client.post(
        "/challenges/public-goal",
        headers=headers,
        json={"target_sessions": 4, "is_public": True},
    )
    updated_goal = client.post(
        "/challenges/public-goal",
        headers=headers,
        json={"target_sessions": 6, "is_public": False},
    )
    checkin = client.post(
        "/challenges/checkin",
        headers=headers,
        json={"did_ship": True, "shipped_note": "Finished a track"},
    )
    joined = client.post(
        "/challenges/join",
        headers=headers,
        json={"challenge_id": challenge_id},
    )
    leaderboard = client.get("/challenges/weekly/leaderboard", headers=headers)

    assert first_goal.status_code == 200
    assert updated_goal.status_code == 200
    assert updated_goal.json()["target_sessions"] == 6
    assert updated_goal.json()["is_public"] is False
    assert checkin.status_code == 200
    assert checkin.json()["did_ship"] is True
    assert joined.status_code == 200
    assert leaderboard.status_code == 200
    assert leaderboard.json()["entries"] == [{"user_id": 1, "score": 0}]
    with SessionLocal() as db:
        event_names = set(
            db.scalars(
                select(GrowthEvent.event_name).where(GrowthEvent.user_id == 1)
            ).all()
        )
        assert {"challenge_checkin_submitted", "challenge_joined"} <= event_names


def test_weekly_challenge_missing_resources_return_not_found(client) -> None:
    token = _register(client, "missing-challenge@example.com", "missing-challenge-user")
    headers = {"Authorization": f"Bearer {token}"}

    missing_join = client.post(
        "/challenges/join",
        headers=headers,
        json={"challenge_id": 9999},
    )
    missing_leaderboard = client.get("/challenges/weekly/leaderboard", headers=headers)

    assert missing_join.status_code == 404
    assert missing_leaderboard.status_code == 404
