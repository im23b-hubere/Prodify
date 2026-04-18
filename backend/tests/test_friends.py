def _register(client, email: str, username: str, password: str = "strong-pass-123"):
    r = client.post("/auth/register", json={"email": email, "username": username, "password": password})
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def test_friend_request_accept_and_leaderboard(client):
    t_a = _register(client, "a@example.com", "alice")
    t_b = _register(client, "b@example.com", "bob")

    req = client.post(
        "/friends/request",
        headers={"Authorization": f"Bearer {t_a}"},
        json={"username": "bob"},
    )
    assert req.status_code == 201, req.text
    fid = req.json()["id"]

    inc = client.get("/friends/incoming", headers={"Authorization": f"Bearer {t_b}"})
    assert inc.status_code == 200
    assert len(inc.json()) == 1
    assert inc.json()[0]["username"] == "alice"

    dup = client.post(
        "/friends/request",
        headers={"Authorization": f"Bearer {t_a}"},
        json={"username": "bob"},
    )
    assert dup.status_code == 400

    acc = client.post(f"/friends/{fid}/accept", headers={"Authorization": f"Bearer {t_b}"})
    assert acc.status_code == 200
    assert acc.json()["status"] == "accepted"

    board = client.get("/friends/leaderboard?period=all", headers={"Authorization": f"Bearer {t_a}"})
    assert board.status_code == 200
    data = board.json()
    assert data["period"] == "all"
    names = {e["username"] for e in data["entries"]}
    assert names == {"alice", "bob"}
    assert len(data["entries"]) == 2


def test_friend_request_reverse_pending_rejected(client):
    t_a = _register(client, "c@example.com", "carol")
    t_b = _register(client, "d@example.com", "dave")

    first = client.post(
        "/friends/request",
        headers={"Authorization": f"Bearer {t_b}"},
        json={"username": "carol"},
    )
    assert first.status_code == 201

    second = client.post(
        "/friends/request",
        headers={"Authorization": f"Bearer {t_a}"},
        json={"username": "dave"},
    )
    assert second.status_code == 400
    assert "already sent" in second.json()["detail"].lower()


def test_delete_pending_cancel(client):
    t_a = _register(client, "e@example.com", "erin")
    t_b = _register(client, "f@example.com", "frank")

    req = client.post(
        "/friends/request",
        headers={"Authorization": f"Bearer {t_a}"},
        json={"username": "frank"},
    )
    assert req.status_code == 201
    fid = req.json()["id"]

    cancel = client.delete(f"/friends/{fid}", headers={"Authorization": f"Bearer {t_a}"})
    assert cancel.status_code == 204

    inc = client.get("/friends/incoming", headers={"Authorization": f"Bearer {t_b}"})
    assert inc.json() == []
