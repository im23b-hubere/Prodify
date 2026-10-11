from datetime import datetime, timezone

from sqlalchemy import select

from app.database import SessionLocal
from app.models import FriendNudge, UserProgression
from app.services import friend_nudge_service
from app.services.friend_nudge_service import next_nudge_available_at
from tests.auth_helpers import auth_headers


def _make_friends(client, sender: dict[str, str], recipient: dict[str, str], recipient_name: str) -> None:
    request = client.post("/friends/request", headers=sender, json={"username": recipient_name})
    assert request.status_code == 201
    accepted = client.post(f"/friends/{request.json()['id']}/accept", headers=recipient)
    assert accepted.status_code == 200


def _capture_pushes(monkeypatch) -> list[dict]:
    pushes: list[dict] = []

    def record(_settings, user_id, title, body, data, *, label):
        pushes.append({"user_id": user_id, "title": title, "data": data, "label": label})

    monkeypatch.setattr(friend_nudge_service, "schedule_push_to_user", record)
    return pushes


def test_friend_nudge_pushes_once_and_links_back_to_the_sender(client, monkeypatch):
    pushes = _capture_pushes(monkeypatch)
    alice = auth_headers(client, "nudge-a@example.com", "nudge-a")
    bob = auth_headers(client, "nudge-b@example.com", "nudge-b")
    _make_friends(client, alice, bob, "nudge-b")

    response = client.post("/users/2/nudge", headers=alice)

    assert response.status_code == 200
    assert response.json()["recipient_user_id"] == 2
    assert pushes == [
        {
            "user_id": 2,
            "title": "👊 nudge-a nudged you",
            "data": {"path": "/profile/1", "kind": "friend_nudge", "from_user_id": "1"},
            "label": "friend-nudge",
        }
    ]


def test_second_nudge_on_the_same_day_is_rejected(client, monkeypatch):
    pushes = _capture_pushes(monkeypatch)
    alice = auth_headers(client, "nudge-c@example.com", "nudge-c")
    bob = auth_headers(client, "nudge-d@example.com", "nudge-d")
    _make_friends(client, alice, bob, "nudge-d")

    assert client.post("/users/2/nudge", headers=alice).status_code == 200
    repeat = client.post("/users/2/nudge", headers=alice)

    assert repeat.status_code == 429
    assert len(pushes) == 1
    with SessionLocal() as db:
        assert len(db.scalars(select(FriendNudge)).all()) == 1


def test_only_friends_can_be_nudged(client, monkeypatch):
    pushes = _capture_pushes(monkeypatch)
    alice = auth_headers(client, "nudge-e@example.com", "nudge-e")
    auth_headers(client, "nudge-f@example.com", "nudge-f")

    assert client.post("/users/2/nudge", headers=alice).status_code == 403
    assert client.post("/users/1/nudge", headers=alice).status_code == 400
    assert pushes == []


def test_friend_profile_exposes_level_and_todays_nudge_state(client, monkeypatch):
    _capture_pushes(monkeypatch)
    alice = auth_headers(client, "nudge-g@example.com", "nudge-g")
    bob = auth_headers(client, "nudge-h@example.com", "nudge-h")
    _make_friends(client, alice, bob, "nudge-h")
    with SessionLocal() as db:
        progression = db.scalar(select(UserProgression).where(UserProgression.user_id == 2))
        if progression is None:
            progression = UserProgression(user_id=2)
            db.add(progression)
        progression.xp_total = 400
        progression.current_level = 4
        progression.xp_to_next_level = 50
        db.commit()

    before = client.get("/users/2/profile", headers=alice).json()
    client.post("/users/2/nudge", headers=alice)
    after = client.get("/users/2/profile", headers=alice).json()

    assert before["level"] == 4
    assert before["xp_total"] == 400
    assert before["nudged_today"] is False
    assert before["next_nudge_at"] is None
    assert after["nudged_today"] is True
    assert after["next_nudge_at"] is not None


def test_nudges_reset_at_utc_midnight():
    late_evening = datetime(2026, 10, 8, 23, 30, tzinfo=timezone.utc)
    assert next_nudge_available_at(late_evening) == datetime(2026, 10, 9, tzinfo=timezone.utc)
