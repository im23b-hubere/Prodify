from datetime import timedelta

from app.models import Streak, utcnow


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
    assert "streak_status_label" in data["entries"][0]
    assert "streak_status_emoji" in data["entries"][0]


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
    assert "already sent" in second.json()["error"]["message"].lower()


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


def test_activity_includes_reaction_and_comment_counts(client):
    t_a = _register(client, "g@example.com", "gina")
    t_b = _register(client, "h@example.com", "hank")

    req = client.post(
        "/friends/request",
        headers={"Authorization": f"Bearer {t_a}"},
        json={"username": "hank"},
    )
    assert req.status_code == 201
    fid = req.json()["id"]
    acc = client.post(f"/friends/{fid}/accept", headers={"Authorization": f"Bearer {t_b}"})
    assert acc.status_code == 200

    start = client.post(
        "/sessions/quick-start",
        headers={"Authorization": f"Bearer {t_a}"},
        json={"session_type": "beat_making"},
    )
    assert start.status_code == 201
    sid = start.json()["id"]
    stop = client.post(
        "/sessions/stop",
        headers={"Authorization": f"Bearer {t_a}"},
        json={"session_id": sid},
    )
    assert stop.status_code == 200

    react = client.post(
        f"/social/feed/{sid}/reactions",
        headers={"Authorization": f"Bearer {t_b}"},
        json={"emoji": "👍"},
    )
    assert react.status_code == 200
    comment = client.post(
        f"/social/feed/{sid}/comments",
        headers={"Authorization": f"Bearer {t_b}"},
        json={"body": "Nice session"},
    )
    assert comment.status_code == 200

    feed = client.get("/friends/activity?limit=20", headers={"Authorization": f"Bearer {t_b}"})
    assert feed.status_code == 200
    row = next((item for item in feed.json() if item["session_id"] == sid), None)
    assert row is not None
    assert row["reactions_count"] >= 1
    assert row["comments_count"] >= 1
    assert row["viewer_reaction"] == "👍"
    assert "streak_status_label" in row
    assert "streak_status_emoji" in row


def test_activity_includes_streak_broken_event_item(client):
    t_a = _register(client, "i@example.com", "iris")
    t_b = _register(client, "j@example.com", "jules")

    req = client.post(
        "/friends/request",
        headers={"Authorization": f"Bearer {t_a}"},
        json={"username": "jules"},
    )
    assert req.status_code == 201
    fid = req.json()["id"]
    acc = client.post(f"/friends/{fid}/accept", headers={"Authorization": f"Bearer {t_b}"})
    assert acc.status_code == 200

    from app.database import SessionLocal

    with SessionLocal() as db:
        streak = db.query(Streak).filter(Streak.user_id == 1).first()
        assert streak is not None
        streak.current_streak = 5
        streak.last_session_date = utcnow() - timedelta(days=2)
        db.commit()

    rec = client.post("/streak/reconcile", headers={"Authorization": f"Bearer {t_a}"})
    assert rec.status_code == 204

    feed = client.get("/friends/activity?limit=20", headers={"Authorization": f"Bearer {t_b}"})
    assert feed.status_code == 200
    rows = feed.json()
    event = next((item for item in rows if item.get("status") == "streak_broken"), None)
    assert event is not None
    assert event["user_id"] == 1
    assert event["session_type"] == "streak_broken"


def test_activity_includes_commitment_published_event_item(client):
    t_a = _register(client, "k@example.com", "kira")
    t_b = _register(client, "l@example.com", "loki")

    req = client.post(
        "/friends/request",
        headers={"Authorization": f"Bearer {t_a}"},
        json={"username": "loki"},
    )
    assert req.status_code == 201
    fid = req.json()["id"]
    acc = client.post(f"/friends/{fid}/accept", headers={"Authorization": f"Bearer {t_b}"})
    assert acc.status_code == 200

    commitment = client.post(
        "/social/commitment",
        headers={"Authorization": f"Bearer {t_a}"},
        json={
            "target_sessions": 4,
            "visibility": "friends",
            "commitment_key": "sessions",
            "period_days": 7,
            "witness_user_ids": [2],
        },
    )
    assert commitment.status_code == 200

    feed = client.get("/friends/activity?limit=20", headers={"Authorization": f"Bearer {t_b}"})
    assert feed.status_code == 200
    rows = feed.json()
    event = next((item for item in rows if item.get("status") == "commitment_published"), None)
    assert event is not None
    assert event["user_id"] == 1
    assert event["session_type"] == "commitment_published"
