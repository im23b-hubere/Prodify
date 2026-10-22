"""Suspended and blocked people stay out of friend surfaces until they are visible again."""

from datetime import datetime, timezone

from app.database import SessionLocal
from app.models import GrowthEvent, ProductionSession, SocialReaction, User, UserBlock
from tests.auth_helpers import auth_headers


def test_suspended_friend_leaves_activity_and_ranking_until_the_suspension_lifts(client):
    viewer = auth_headers(client, "hide-view@example.com", "hide-view")
    normal = auth_headers(client, "hide-ok@example.com", "hide-ok")
    suspended = auth_headers(client, "hide-ban@example.com", "hide-ban")
    viewer_id = _user_id(client, viewer)
    normal_id = _user_id(client, normal)
    suspended_id = _user_id(client, suspended)
    _befriend(client, viewer, "hide-ok", normal)
    _befriend(client, viewer, "hide-ban", suspended)
    viewer_session = _store_session(viewer_id)
    _store_session(normal_id)
    _store_session(suspended_id)
    _store_session(suspended_id, live=True)
    _store_event(suspended_id, "streak_broken")
    _react(suspended_id, viewer_session)
    _suspend(suspended_id)

    activity = client.get("/friends/activity?limit=20", headers=viewer).json()
    board = client.get("/friends/leaderboard?period=week", headers=viewer).json()
    reactions = client.get(f"/social/feed/{viewer_session}/reactions/users", headers=viewer).json()

    assert _names(activity) == {"hide-view", "hide-ok"}
    assert {entry["username"] for entry in board["entries"]} == {"hide-view", "hide-ok"}
    assert reactions == []
    assert _row(activity, viewer_session)["reactions_count"] == 0

    _lift(suspended_id)

    restored = client.get("/friends/activity?limit=20", headers=viewer).json()
    restored_board = client.get("/friends/leaderboard?period=week", headers=viewer).json()
    assert "hide-ban" in _names(restored)
    assert any(item["status"] == "live" and item["user_id"] == suspended_id for item in restored)
    assert {entry["username"] for entry in restored_board["entries"]} == {"hide-view", "hide-ok", "hide-ban"}


def test_blocked_friend_with_a_leftover_friendship_stays_out_of_the_feed(client):
    viewer = auth_headers(client, "hide-block-view@example.com", "hide-block-view")
    blocked = auth_headers(client, "hide-block-ban@example.com", "hide-block-ban")
    viewer_id = _user_id(client, viewer)
    blocked_id = _user_id(client, blocked)
    _befriend(client, viewer, "hide-block-ban", blocked)
    _store_session(viewer_id)
    _store_session(blocked_id)
    with SessionLocal() as db:
        db.add(UserBlock(blocker_id=viewer_id, blocked_id=blocked_id))
        db.commit()

    activity = client.get("/friends/activity?limit=20", headers=viewer).json()
    board = client.get("/friends/leaderboard?period=all", headers=viewer).json()

    assert _names(activity) == {"hide-block-view"}
    assert {entry["username"] for entry in board["entries"]} == {"hide-block-view"}


def test_hidden_friend_profile_and_session_stay_closed_until_the_suspension_lifts(client):
    viewer = auth_headers(client, "hide-prof-view@example.com", "hide-prof-view")
    hidden = auth_headers(client, "hide-prof-ban@example.com", "hide-prof-ban")
    hidden_id = _user_id(client, hidden)
    _befriend(client, viewer, "hide-prof-ban", hidden)
    session_id = _store_session(hidden_id)
    _suspend(hidden_id)

    assert client.get(f"/users/{hidden_id}/profile", headers=viewer).status_code == 404
    assert client.get(f"/users/{hidden_id}/stats", headers=viewer).status_code == 404
    assert client.get(f"/users/{hidden_id}/sessions", headers=viewer).status_code == 404
    assert client.get(f"/users/{hidden_id}/commitment", headers=viewer).status_code == 404
    assert client.post(f"/users/{hidden_id}/nudge", headers=viewer).status_code == 403
    assert client.get(f"/sessions/item/{session_id}", headers=viewer).status_code == 404
    assert client.get(f"/social/feed/{session_id}/reactions/users", headers=viewer).status_code == 404

    _lift(hidden_id)

    assert client.get(f"/users/{hidden_id}/profile", headers=viewer).status_code == 200
    assert client.get(f"/sessions/item/{session_id}", headers=viewer).status_code == 200


def test_hidden_friend_is_omitted_from_rank_path_context_and_team_total(client):
    viewer = auth_headers(client, "hide-rank-view@example.com", "hide-rank-view")
    normal = auth_headers(client, "hide-rank-ok@example.com", "hide-rank-ok")
    hidden = auth_headers(client, "hide-rank-ban@example.com", "hide-rank-ban")
    normal_id = _user_id(client, normal)
    hidden_id = _user_id(client, hidden)
    _befriend(client, viewer, "hide-rank-ok", normal)
    _befriend(client, viewer, "hide-rank-ban", hidden)
    _store_session(normal_id)
    _store_session(hidden_id)
    _suspend(hidden_id)

    progression = client.get("/friends/progression", headers=viewer).json()
    context = client.get("/social/leaderboard/context", headers=viewer).json()
    recap = client.get("/social/weekly-recap", headers=viewer).json()

    assert {friend["username"] for friend in progression["friends"]} == {"hide-rank-ok"}
    assert {entry["username"] for entry in context["entries"]} == {"hide-rank-view", "hide-rank-ok"}
    assert recap["team_sessions"] == 1

    _lift(hidden_id)

    restored = client.get("/social/weekly-recap", headers=viewer).json()
    assert restored["team_sessions"] == 2


def test_incoming_request_from_a_suspended_user_is_hidden_until_the_suspension_lifts(client):
    viewer = auth_headers(client, "hide-in-view@example.com", "hide-in-view")
    requester = auth_headers(client, "hide-in-ban@example.com", "hide-in-ban")
    requester_id = _user_id(client, requester)
    created = client.post("/friends/request", headers=requester, json={"username": "hide-in-view"})
    assert created.status_code == 201, created.text
    friendship_id = created.json()["id"]
    _suspend(requester_id)

    incoming = client.get("/friends/incoming", headers=viewer).json()
    inbox = client.get("/notifications/inbox", headers=viewer).json()
    refused = client.post(f"/friends/{friendship_id}/accept", headers=viewer)

    assert incoming == []
    assert all(item.get("body_params", {}).get("username") != "hide-in-ban" for item in inbox)
    assert refused.status_code == 404

    _lift(requester_id)

    restored = client.get("/friends/incoming", headers=viewer).json()
    assert [row["username"] for row in restored] == ["hide-in-ban"]
    assert client.post(f"/friends/{friendship_id}/accept", headers=viewer).status_code == 200


def _befriend(client, left_headers, right_username: str, right_headers) -> None:
    created = client.post("/friends/request", headers=left_headers, json={"username": right_username})
    assert created.status_code == 201, created.text
    accepted = client.post(f"/friends/{created.json()['id']}/accept", headers=right_headers)
    assert accepted.status_code == 200, accepted.text


def _user_id(client, headers) -> int:
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    return me.json()["id"]


def _store_session(user_id: int, *, live: bool = False) -> int:
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        session = ProductionSession(
            user_id=user_id,
            started_at=now,
            stopped_at=None if live else now,
            duration_seconds=None if live else 1800,
            session_type="beat_making",
        )
        db.add(session)
        db.commit()
        return session.id


def _store_event(user_id: int, event_name: str) -> None:
    with SessionLocal() as db:
        db.add(GrowthEvent(user_id=user_id, event_name=event_name, event_props_json="{}"))
        db.commit()


def _react(user_id: int, session_id: int) -> None:
    with SessionLocal() as db:
        db.add(SocialReaction(target_type="session", target_id=session_id, user_id=user_id, emoji="🔥"))
        db.commit()


def _suspend(user_id: int) -> None:
    with SessionLocal() as db:
        db.get(User, user_id).suspended_at = datetime.now(timezone.utc)
        db.commit()


def _lift(user_id: int) -> None:
    with SessionLocal() as db:
        db.get(User, user_id).suspended_at = None
        db.commit()


def _names(activity: list[dict]) -> set[str]:
    return {item["username"] for item in activity}


def _row(activity: list[dict], session_id: int) -> dict:
    return next(item for item in activity if item["session_id"] == session_id)
