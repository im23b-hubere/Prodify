from datetime import datetime

from app.database import SessionLocal
from app.models import PushToken


def _auth_headers(client, email: str, username: str, password: str = "strong-pass-123") -> dict[str, str]:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert register.status_code == 201
    token = register.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _make_friends(client, requester_headers: dict[str, str], accepter_headers: dict[str, str], accepter_username: str) -> None:
    req = client.post("/friends/request", headers=requester_headers, json={"username": accepter_username})
    assert req.status_code == 201
    fid = req.json()["id"]
    accepted = client.post(f"/friends/{fid}/accept", headers=accepter_headers)
    assert accepted.status_code == 200


def test_register_push_token_creates_and_reactivates_existing_token(client):
    headers = _auth_headers(client, "push-token@example.com", "push-token-user")
    payload = {"token": "ExponentPushToken[test-token-001]", "platform": "ios", "channel": "expo"}

    created = client.post("/notifications/register-token", headers=headers, json=payload)
    assert created.status_code == 204

    with SessionLocal() as db:
        row = db.query(PushToken).filter(PushToken.token == payload["token"]).one()
        row.is_active = 0
        db.add(row)
        db.commit()

    updated = client.post(
        "/notifications/register-token",
        headers=headers,
        json={"token": payload["token"], "platform": "android", "channel": "expo"},
    )
    assert updated.status_code == 204

    with SessionLocal() as db:
        row = db.query(PushToken).filter(PushToken.token == payload["token"]).one()
        assert row.is_active == 1
        assert row.platform == "android"
        assert row.last_used_at is not None


def test_register_push_token_respects_feature_flag(client, monkeypatch):
    headers = _auth_headers(client, "push-flag@example.com", "push-flag-user")
    monkeypatch.setattr("app.routers.notifications.settings.feature_flag_push_notifications_enabled", False)
    created = client.post(
        "/notifications/register-token",
        headers=headers,
        json={"token": "ExponentPushToken[flag-test]", "platform": "ios", "channel": "expo"},
    )
    assert created.status_code == 503
    assert "temporarily disabled" in created.json()["error"]["message"].lower()


def test_smart_nudge_validates_payload(client):
    headers = _auth_headers(client, "smart-nudge@example.com", "smart-nudge-user")
    invalid = client.post(
        "/notifications/smart-nudge",
        headers=headers,
        json={"kind": "best_time", "hour": "invalid-hour"},
    )
    assert invalid.status_code == 422


def test_smart_nudge_accepts_typed_payload(client, monkeypatch):
    headers = _auth_headers(client, "smart-nudge-ok@example.com", "smart-nudge-ok-user")
    monkeypatch.setattr("app.routers.notifications.send_ping", lambda *_args, **_kwargs: (1, 1, "ok"))
    ok = client.post(
        "/notifications/smart-nudge",
        headers=headers,
        json={"kind": "forecast_risk", "remaining_sessions": 2, "days_left": 1},
    )
    assert ok.status_code == 200


def test_notifications_inbox_rejects_out_of_range_since_ms(client):
    headers = _auth_headers(client, "notif-inbox-ts@example.com", "notif-inbox-ts-user")
    res = client.get("/notifications/inbox?since_ms=999999999999999999999", headers=headers)
    assert res.status_code == 422
    message = res.json().get("error", {}).get("message", "")
    assert "since_ms" in message


def test_notifications_read_rejects_out_of_range_up_to_ms(client):
    headers = _auth_headers(client, "notif-read-ts@example.com", "notif-read-ts-user")
    res = client.post("/notifications/read", headers=headers, json={"up_to_ms": 999999999999999999999})
    assert res.status_code == 422
    message = res.json().get("error", {}).get("message", "")
    assert "up_to_ms" in message


def test_notifications_inbox_read_state_monotonic_and_since_filter(client):
    owner = _auth_headers(client, "notif-owner@example.com", "notif-owner")
    sender = _auth_headers(client, "notif-sender@example.com", "notif-sender")
    pending = client.post("/friends/request", headers=sender, json={"username": "notif-owner"})
    assert pending.status_code == 201

    inbox = client.get("/notifications/inbox", headers=owner)
    assert inbox.status_code == 200
    items = inbox.json()
    friend_request_items = [it for it in items if str(it.get("id", "")).startswith("friend-request-")]
    assert friend_request_items
    newest = friend_request_items[0]
    assert newest.get("read") is False

    created_at = str(newest["created_at"]).replace("Z", "+00:00")
    created_ms = int(datetime.fromisoformat(created_at).timestamp() * 1000)

    mark = client.post("/notifications/read", headers=owner, json={"up_to_ms": created_ms + 1000})
    assert mark.status_code == 204

    after_mark = client.get("/notifications/inbox", headers=owner)
    assert after_mark.status_code == 200
    marked_item = next(
        it for it in after_mark.json() if str(it.get("id", "")).startswith("friend-request-")
    )
    assert marked_item.get("read") is True

    older_mark = client.post("/notifications/read", headers=owner, json={"up_to_ms": 1})
    assert older_mark.status_code == 204
    after_older_mark = client.get("/notifications/inbox", headers=owner)
    assert after_older_mark.status_code == 200
    still_read = next(
        it for it in after_older_mark.json() if str(it.get("id", "")).startswith("friend-request-")
    )
    assert still_read.get("read") is True

    since_filtered = client.get(f"/notifications/inbox?since_ms={created_ms + 1000}", headers=owner)
    assert since_filtered.status_code == 200
    assert all(it.get("id") != newest.get("id") for it in since_filtered.json())


def test_notifications_inbox_dedupes_multiple_session_comments(client):
    owner = _auth_headers(client, "notif-comment-owner@example.com", "notif-comment-owner")
    commenter = _auth_headers(client, "notif-commenter@example.com", "notif-commenter")
    _make_friends(client, owner, commenter, "notif-commenter")

    started = client.post("/sessions/quick-start", headers=owner, json={"session_type": "beat_making"})
    assert started.status_code == 201
    sid = int(started.json()["id"])
    stopped = client.post("/sessions/stop", headers=owner, json={"session_id": sid})
    assert stopped.status_code == 200

    c1 = client.post(f"/social/feed/{sid}/comments", headers=commenter, json={"body": "first"})
    c2 = client.post(f"/social/feed/{sid}/comments", headers=commenter, json={"body": "second"})
    assert c1.status_code == 200
    assert c2.status_code == 200

    inbox = client.get("/notifications/inbox", headers=owner)
    assert inbox.status_code == 200
    comment_notifications = [
        it for it in inbox.json() if str(it.get("id", "")).startswith(f"session-comment-{sid}-")
    ]
    assert len(comment_notifications) == 1
