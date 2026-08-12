def _auth_headers(client, email: str, username: str, password: str = "strong-pass-123") -> dict[str, str]:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert register.status_code == 201
    token = register.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_stop_session_updates_streak_last_session_date(client):
    headers = _auth_headers(client, "streakdate@example.com", "streakdate-user")
    started = client.post(
        "/sessions/start",
        headers=headers,
        json={"session_type": "beat_making"},
    )
    assert started.status_code == 201
    session_id = started.json()["id"]
    stopped = client.post("/sessions/stop", headers=headers, json={"session_id": session_id})
    assert stopped.status_code == 200

    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import Streak

    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    uid = me.json()["id"]

    with SessionLocal() as db:
        row = db.scalar(select(Streak).where(Streak.user_id == uid))
        assert row is not None
        assert row.last_session_date is not None


def test_session_lifecycle_and_trash_restore(client):
    headers = _auth_headers(client, "session@example.com", "session-user")

    started = client.post(
        "/sessions/start",
        headers=headers,
        json={"session_type": "mixing", "notes": "initial note"},
    )
    assert started.status_code == 201
    session_id = started.json()["id"]
    assert started.json()["session_type"] == "mixing"

    listed = client.get("/sessions/list", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    stopped = client.post("/sessions/stop", headers=headers, json={"session_id": session_id})
    assert stopped.status_code == 200
    assert stopped.json()["stopped_at"] is not None
    assert stopped.json()["duration_seconds"] is not None
    assert stopped.json()["track_outcome"] is None
    assert stopped.json()["track_title"] is None

    deleted = client.delete(f"/sessions/item/{session_id}", headers=headers)
    assert deleted.status_code == 204

    listed_after_delete = client.get("/sessions/list", headers=headers)
    assert listed_after_delete.status_code == 200
    assert listed_after_delete.json() == []

    trash = client.get("/sessions/trash", headers=headers)
    assert trash.status_code == 200
    assert len(trash.json()) == 1
    assert trash.json()[0]["id"] == session_id

    restored = client.post(f"/sessions/item/{session_id}/restore", headers=headers)
    assert restored.status_code == 200
    assert restored.json()["id"] == session_id

    listed_after_restore = client.get("/sessions/list", headers=headers)
    assert listed_after_restore.status_code == 200
    assert len(listed_after_restore.json()) == 1


def test_session_track_outcome_update_persists(client):
    headers = _auth_headers(client, "session-track@example.com", "session-track-user")
    started = client.post(
        "/sessions/start",
        headers=headers,
        json={"session_type": "beat_making", "notes": "drafting hooks"},
    )
    assert started.status_code == 201
    session_id = started.json()["id"]

    stopped = client.post("/sessions/stop", headers=headers, json={"session_id": session_id})
    assert stopped.status_code == 200

    set_finished = client.patch(
        f"/sessions/item/{session_id}",
        headers=headers,
        json={"track_outcome": "finished", "track_title": "Night Drive"},
    )
    assert set_finished.status_code == 200
    assert set_finished.json()["track_outcome"] == "finished"
    assert set_finished.json()["track_title"] == "Night Drive"

    set_wip = client.patch(
        f"/sessions/item/{session_id}",
        headers=headers,
        json={"track_outcome": "wip"},
    )
    assert set_wip.status_code == 200
    assert set_wip.json()["track_outcome"] == "wip"
    assert set_wip.json()["track_title"] is None


def test_completed_session_is_visible_to_friends_but_not_strangers(client):
    owner = _auth_headers(client, "record-owner@example.com", "record-owner")
    friend = _auth_headers(client, "record-friend@example.com", "record-friend")
    stranger = _auth_headers(client, "record-stranger@example.com", "record-stranger")
    request = client.post(
        "/friends/request",
        headers=friend,
        json={"username": "record-owner"},
    )
    assert request.status_code == 201
    accepted = client.post(f"/friends/{request.json()['id']}/accept", headers=owner)
    assert accepted.status_code == 200

    started = client.post(
        "/sessions/start",
        headers=owner,
        json={"session_type": "mixing"},
    )
    session_id = started.json()["id"]
    assert client.post(
        "/sessions/stop",
        headers=owner,
        json={"session_id": session_id},
    ).status_code == 200

    visible = client.get(f"/sessions/item/{session_id}", headers=friend)
    hidden = client.get(f"/sessions/item/{session_id}", headers=stranger)

    assert visible.status_code == 200
    assert hidden.status_code == 404


def test_completed_session_insights_contract(client):
    headers = _auth_headers(client, "session-insights@example.com", "session-insights-user")
    started = client.post(
        "/sessions/start",
        headers=headers,
        json={"session_type": "mixing"},
    )
    assert started.status_code == 201
    session_id = started.json()["id"]

    active_insights = client.get(f"/sessions/item/{session_id}/insights", headers=headers)
    assert active_insights.status_code == 400
    assert client.post(
        "/sessions/stop",
        headers=headers,
        json={"session_id": session_id},
    ).status_code == 200

    response = client.get(f"/sessions/item/{session_id}/insights", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["focus_tier"] in {"excellent", "strong", "solid", "room_to_improve"}
    assert body["active_seconds"] >= 0
    assert body["paused_seconds"] >= 0
    assert body["impact_items"]
    assert any(item["key"] == "prod_minimal_pause" for item in body["productivity_items"])
    assert isinstance(body["timeline"], list)
    assert isinstance(body["related_sessions"], list)
