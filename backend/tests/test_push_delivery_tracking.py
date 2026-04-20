from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import PushToken
from app.services.push_dispatch import dispatch_to_user
from app.config import settings


def _auth_headers(client, email: str, username: str, password: str = "strong-pass-123") -> dict[str, str]:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert register.status_code == 201
    token = register.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_dispatch_deactivates_invalid_tokens_and_tracks_last_used(client, monkeypatch):
    headers = _auth_headers(client, "push-track@example.com", "push-track-user")
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    user_id = me.json()["id"]

    old_dt = datetime.now(timezone.utc) - timedelta(days=1)
    with SessionLocal() as db:
        db.add(
            PushToken(
                user_id=user_id,
                token="ExponentPushToken[invalid-001]",
                platform="ios",
                channel="expo",
                is_active=1,
                created_at=old_dt,
                last_used_at=old_dt,
            )
        )
        db.add(
            PushToken(
                user_id=user_id,
                token="ExponentPushToken[valid-001]",
                platform="ios",
                channel="expo",
                is_active=1,
                created_at=old_dt,
                last_used_at=old_dt,
            )
        )
        db.commit()

    def _fake_expo_send(_access_token, messages):
        return len(messages), 1, "DeviceNotRegistered", ["ExponentPushToken[invalid-001]"]

    monkeypatch.setattr("app.services.expo_client.send_expo_batch", _fake_expo_send)
    monkeypatch.setattr(settings, "expo_access_token", "test-token")

    with SessionLocal() as db:
        attempted, ok, message = dispatch_to_user(settings, db, user_id, "Title", "Body", data={"kind": "test"})
        assert attempted == 2
        assert ok == 1
        assert message is not None

        invalid = db.query(PushToken).filter(PushToken.token == "ExponentPushToken[invalid-001]").one()
        valid = db.query(PushToken).filter(PushToken.token == "ExponentPushToken[valid-001]").one()
        assert invalid.is_active == 0
        assert valid.is_active == 1
        assert valid.last_used_at != old_dt
