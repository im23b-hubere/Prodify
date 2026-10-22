from sqlalchemy import or_, select

from app.database import SessionLocal
from app.models import UserBlock
from tests.auth_helpers import auth_headers
from tests.test_social import _complete_long_session, _duel, _make_friends


def _user_id(client, headers: dict[str, str]) -> int:
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    return me.json()["id"]


def _block(client, headers: dict[str, str], user_id: int):
    return client.post(f"/users/{user_id}/block", headers=headers)


def _comment(client, headers: dict[str, str], session_id: int, body: str) -> None:
    response = client.post(f"/social/feed/{session_id}/comments", headers=headers, json={"body": body})
    assert response.status_code == 200, response.text


def test_blocking_a_friend_ends_the_friendship(client):
    alice = auth_headers(client, "block-a@example.com", "block-alice")
    bob = auth_headers(client, "block-b@example.com", "block-bob")
    _make_friends(client, alice, bob, "block-bob")

    assert _block(client, alice, _user_id(client, bob)).status_code == 204

    hidden = client.get(f"/users/{_user_id(client, alice)}/profile", headers=bob)
    missing = client.get("/users/999999/profile", headers=bob)
    assert hidden.status_code == missing.status_code == 404
    assert hidden.json()["error"]["message"] == missing.json()["error"]["message"]
    board = client.get("/friends/leaderboard?period=all", headers=alice).json()
    assert {entry["username"] for entry in board["entries"]} == {"block-alice"}


def test_blocking_removes_a_pending_friend_request(client):
    alice = auth_headers(client, "block-req-a@example.com", "block-req-alice")
    stranger = auth_headers(client, "block-req-s@example.com", "block-req-stranger")
    assert client.post("/friends/request", headers=stranger, json={"username": "block-req-alice"}).status_code == 201

    assert _block(client, alice, _user_id(client, stranger)).status_code == 204

    assert client.get("/friends/incoming", headers=alice).json() == []


def test_blocked_user_cannot_send_a_friend_request_and_learns_nothing(client):
    alice = auth_headers(client, "block-hide-a@example.com", "block-hide-alice")
    stranger = auth_headers(client, "block-hide-s@example.com", "block-hide-stranger")
    _block(client, alice, _user_id(client, stranger))

    blocked_attempt = client.post("/friends/request", headers=stranger, json={"username": "block-hide-alice"})
    unknown_attempt = client.post("/friends/request", headers=stranger, json={"username": "nobody-here"})

    assert blocked_attempt.status_code == unknown_attempt.status_code == 404
    assert blocked_attempt.json()["error"]["message"] == unknown_attempt.json()["error"]["message"]


def test_blocker_cannot_send_a_friend_request_to_the_blocked_user(client):
    alice = auth_headers(client, "block-out-a@example.com", "block-out-alice")
    stranger = auth_headers(client, "block-out-s@example.com", "block-out-stranger")
    _block(client, alice, _user_id(client, stranger))

    response = client.post("/friends/request", headers=alice, json={"username": "block-out-stranger"})

    assert response.status_code == 404


def test_comments_of_a_blocked_user_disappear_on_a_mutual_friends_session(client):
    host = auth_headers(client, "block-host@example.com", "block-host")
    alice = auth_headers(client, "block-mut-a@example.com", "block-mut-alice")
    bob = auth_headers(client, "block-mut-b@example.com", "block-mut-bob")
    _make_friends(client, host, alice, "block-mut-alice")
    _make_friends(client, host, bob, "block-mut-bob")
    session_id = _complete_long_session(client, host)
    _comment(client, alice, session_id, "from alice")
    _comment(client, bob, session_id, "from bob")

    _block(client, alice, _user_id(client, bob))

    seen_by_alice = client.get(f"/social/feed/{session_id}/comments", headers=alice).json()
    seen_by_bob = client.get(f"/social/feed/{session_id}/comments", headers=bob).json()
    seen_by_host = client.get(f"/social/feed/{session_id}/comments", headers=host).json()
    assert [comment["body"] for comment in seen_by_alice] == ["from alice"]
    assert [comment["body"] for comment in seen_by_bob] == ["from bob"]
    assert len(seen_by_host) == 2


def test_reactions_of_a_blocked_user_are_not_shown_or_counted(client):
    host = auth_headers(client, "block-react-host@example.com", "block-react-host")
    alice = auth_headers(client, "block-react-a@example.com", "block-react-alice")
    bob = auth_headers(client, "block-react-b@example.com", "block-react-bob")
    _make_friends(client, host, alice, "block-react-alice")
    _make_friends(client, host, bob, "block-react-bob")
    session_id = _complete_long_session(client, host)
    client.post(f"/social/feed/{session_id}/reactions", headers=bob, json={"emoji": "🔥"})

    _block(client, alice, _user_id(client, bob))

    assert client.get(f"/social/feed/{session_id}/reactions", headers=alice).json() == []
    assert client.get(f"/social/feed/{session_id}/reactions/users", headers=alice).json() == []


def test_inbox_drops_comment_news_from_a_blocked_user(client):
    alice = auth_headers(client, "block-inbox-a@example.com", "block-inbox-alice")
    bob = auth_headers(client, "block-inbox-b@example.com", "block-inbox-bob")
    _make_friends(client, alice, bob, "block-inbox-bob")
    session_id = _complete_long_session(client, alice)
    _comment(client, bob, session_id, "hey")

    _block(client, alice, _user_id(client, bob))

    inbox = client.get("/notifications/inbox", headers=alice).json()
    assert not any(item["id"].startswith("session-comment-") for item in inbox)


def test_blocking_cancels_an_open_duel_between_both(client):
    alice = auth_headers(client, "block-duel-a@example.com", "block-duel-alice")
    bob = auth_headers(client, "block-duel-b@example.com", "block-duel-bob")
    _make_friends(client, alice, bob, "block-duel-bob")
    duel = _duel(client, alice, title="Showdown", friend_id=_user_id(client, bob))

    _block(client, bob, _user_id(client, alice))

    listed = client.get("/social/challenges", headers=alice).json()
    assert next(item for item in listed if item["id"] == duel["id"])["status"] == "cancelled"


def test_blocking_ends_an_accountability_buddy_pairing(client):
    alice = auth_headers(client, "block-buddy-a@example.com", "block-buddy-alice")
    bob = auth_headers(client, "block-buddy-b@example.com", "block-buddy-bob")
    _make_friends(client, alice, bob, "block-buddy-bob")
    invite = client.post("/social/buddy/invite", headers=alice, json={"friend_user_id": _user_id(client, bob)})
    client.post("/social/buddy/accept", headers=bob, json={"invite_id": invite.json()["invite_id"]})

    _block(client, alice, _user_id(client, bob))

    assert client.get("/social/buddy", headers=alice).json()["status"] == "none"


def test_blocked_users_are_listed_and_can_be_unblocked(client):
    alice = auth_headers(client, "block-list-a@example.com", "block-list-alice")
    bob = auth_headers(client, "block-list-b@example.com", "block-list-bob")
    bob_id = _user_id(client, bob)
    _block(client, alice, bob_id)

    listed = client.get("/users/me/blocked", headers=alice).json()
    assert [(entry["user_id"], entry["username"]) for entry in listed] == [(bob_id, "block-list-bob")]

    assert client.delete(f"/users/{bob_id}/block", headers=alice).status_code == 204
    assert client.get("/users/me/blocked", headers=alice).json() == []
    assert client.post("/friends/request", headers=bob, json={"username": "block-list-alice"}).status_code == 201


def test_blocking_twice_is_harmless(client):
    alice = auth_headers(client, "block-twice-a@example.com", "block-twice-alice")
    bob_id = _user_id(client, auth_headers(client, "block-twice-b@example.com", "block-twice-bob"))

    assert _block(client, alice, bob_id).status_code == 204
    assert _block(client, alice, bob_id).status_code == 204
    assert len(client.get("/users/me/blocked", headers=alice).json()) == 1


def test_blocking_yourself_is_rejected(client):
    alice = auth_headers(client, "block-self@example.com", "block-self")

    assert _block(client, alice, _user_id(client, alice)).status_code == 400


def test_blocking_an_unknown_user_is_rejected(client):
    alice = auth_headers(client, "block-ghost@example.com", "block-ghost")

    assert _block(client, alice, 9999).status_code == 404


def test_deleting_an_account_removes_its_blocks_in_both_directions(client):
    alice = auth_headers(client, "block-gone-a@example.com", "block-gone-alice")
    bob = auth_headers(client, "block-gone-b@example.com", "block-gone-bob")
    carol = auth_headers(client, "block-gone-c@example.com", "block-gone-carol")
    bob_id = _user_id(client, bob)
    _block(client, alice, bob_id)
    _block(client, bob, _user_id(client, carol))

    assert client.delete("/users/me", headers=bob).status_code == 204

    with SessionLocal() as db:
        remaining = db.scalars(
            select(UserBlock).where(or_(UserBlock.blocker_id == bob_id, UserBlock.blocked_id == bob_id))
        ).all()
    assert remaining == []


def test_blocking_works_without_a_subscription(client):
    alice = auth_headers(client, "block-free-a@example.com", "block-free-alice", subscriber=False)
    bob_id = _user_id(client, auth_headers(client, "block-free-b@example.com", "block-free-bob"))

    assert _block(client, alice, bob_id).status_code == 204
