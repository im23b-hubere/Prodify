"""Friend request / accept should notify the other person with a deep link to Friends."""

from app.services import friendship_service
from tests.auth_helpers import auth_headers


def _user_id(client, headers: dict[str, str]) -> int:
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    return int(me.json()["id"])


def _capture_pushes(monkeypatch) -> list[dict]:
    pushes: list[dict] = []

    def record(_settings, user_id, title, body, data, *, label):
        pushes.append({"user_id": user_id, "title": title, "body": body, "data": data, "label": label})

    monkeypatch.setattr(friendship_service, "schedule_push_to_user", record)
    return pushes


def test_sending_a_friend_request_pushes_the_target(client, monkeypatch):
    pushes = _capture_pushes(monkeypatch)
    alice = auth_headers(client, "push-req-a@example.com", "push-req-a")
    bob = auth_headers(client, "push-req-b@example.com", "push-req-b")
    alice_id = _user_id(client, alice)
    bob_id = _user_id(client, bob)

    response = client.post("/friends/request", headers=alice, json={"username": "push-req-b"})

    assert response.status_code == 201, response.text
    assert pushes == [
        {
            "user_id": bob_id,
            "title": "Friend request",
            "body": "push-req-a wants to be friends.",
            "data": {
                "path": "/(tabs)/friends",
                "kind": "friend_request",
                "from_user_id": str(alice_id),
            },
            "label": "friend-request",
        }
    ]


def test_accepting_a_friend_request_pushes_the_requester(client, monkeypatch):
    pushes = _capture_pushes(monkeypatch)
    alice = auth_headers(client, "push-acc-a@example.com", "push-acc-a")
    bob = auth_headers(client, "push-acc-b@example.com", "push-acc-b")
    alice_id = _user_id(client, alice)
    bob_id = _user_id(client, bob)

    request = client.post("/friends/request", headers=alice, json={"username": "push-acc-b"})
    assert request.status_code == 201
    friendship_id = request.json()["id"]
    pushes.clear()

    accepted = client.post(f"/friends/{friendship_id}/accept", headers=bob)

    assert accepted.status_code == 200, accepted.text
    assert pushes == [
        {
            "user_id": alice_id,
            "title": "Friend request accepted",
            "body": "push-acc-b accepted your friend request.",
            "data": {
                "path": "/(tabs)/friends",
                "kind": "friend_accepted",
                "from_user_id": str(bob_id),
            },
            "label": "friend-accepted",
        }
    ]
