from sqlalchemy import select

from app.database import SessionLocal
from app.models import UserProgression
from tests.auth_helpers import auth_headers


def _make_friends(client, sender: dict[str, str], recipient: dict[str, str], recipient_name: str) -> None:
    request = client.post("/friends/request", headers=sender, json={"username": recipient_name})
    assert request.status_code == 201
    accepted = client.post(f"/friends/{request.json()['id']}/accept", headers=recipient)
    assert accepted.status_code == 200


def _set_level(user_id: int, level: int, xp_total: int = 0) -> None:
    with SessionLocal() as db:
        progression = db.scalar(select(UserProgression).where(UserProgression.user_id == user_id))
        if progression is None:
            progression = UserProgression(user_id=user_id)
            db.add(progression)
        progression.current_level = level
        progression.xp_total = xp_total
        progression.xp_to_next_level = 50
        db.commit()


def test_friends_progression_empty_when_no_friends(client):
    headers = auth_headers(client, "prog-solo@example.com", "progsolo")

    response = client.get("/friends/progression", headers=headers)

    assert response.status_code == 200
    assert response.json() == {"friends": []}


def test_friends_progression_excludes_pending_and_self(client):
    alice = auth_headers(client, "prog-a@example.com", "proga")
    bob = auth_headers(client, "prog-b@example.com", "progb")
    client.post("/friends/request", headers=alice, json={"username": "progb"})

    response = client.get("/friends/progression", headers=alice)

    assert response.status_code == 200
    assert response.json() == {"friends": []}


def test_friends_progression_returns_accepted_friends_levels(client):
    alice = auth_headers(client, "prog-c@example.com", "progc")
    bob = auth_headers(client, "prog-d@example.com", "progd")
    cara = auth_headers(client, "prog-e@example.com", "proge")
    _make_friends(client, alice, bob, "progd")
    _make_friends(client, alice, cara, "proge")
    _set_level(2, level=7, xp_total=1800)
    _set_level(3, level=3, xp_total=200)

    response = client.get("/friends/progression", headers=alice)

    assert response.status_code == 200
    friends = response.json()["friends"]
    by_username = {entry["username"]: entry for entry in friends}
    assert set(by_username) == {"progd", "proge"}
    assert by_username["progd"]["user_id"] == 2
    assert by_username["progd"]["level"] == 7
    assert by_username["proge"]["level"] == 3
    assert "profile_picture_url" in by_username["progd"]
    assert "progc" not in by_username


def test_friends_progression_defaults_missing_progression_to_level_one(client):
    alice = auth_headers(client, "prog-f@example.com", "progf")
    bob = auth_headers(client, "prog-g@example.com", "progg")
    _make_friends(client, alice, bob, "progg")
    with SessionLocal() as db:
        row = db.scalar(select(UserProgression).where(UserProgression.user_id == 2))
        if row is not None:
            db.delete(row)
            db.commit()

    response = client.get("/friends/progression", headers=alice)

    assert response.status_code == 200
    assert response.json()["friends"] == [
        {
            "user_id": 2,
            "username": "progg",
            "profile_picture_url": None,
            "level": 1,
        }
    ]


def test_friends_progression_clamps_level_to_catalog_max(client):
    alice = auth_headers(client, "prog-h@example.com", "progh")
    bob = auth_headers(client, "prog-i@example.com", "progi")
    _make_friends(client, alice, bob, "progi")
    _set_level(2, level=99, xp_total=99999)

    response = client.get("/friends/progression", headers=alice)

    assert response.status_code == 200
    assert response.json()["friends"][0]["level"] == 20
