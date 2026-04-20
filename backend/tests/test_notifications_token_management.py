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
