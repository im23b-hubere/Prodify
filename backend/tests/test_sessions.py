def _auth_headers(client, email: str, username: str, password: str = "strong-pass-123") -> dict[str, str]:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert register.status_code == 201
    token = register.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


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
