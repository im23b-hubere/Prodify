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
