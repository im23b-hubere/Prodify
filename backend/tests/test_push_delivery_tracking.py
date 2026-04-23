from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import PushToken
from app.services.push_dispatch import dispatch_to_user, schedule_notify_session_complete
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


def test_schedule_notify_session_complete_uses_shared_executor(monkeypatch):
    submitted = {"count": 0}

    class _FakeExecutor:
        def submit(self, fn):
            submitted["count"] += 1
            fn()
            return None

    calls = {"count": 0}

    def _fake_notify(*_args, **_kwargs):
        calls["count"] += 1

    monkeypatch.setattr("app.services.push_dispatch._get_push_executor", lambda _settings: _FakeExecutor())
    monkeypatch.setattr(settings, "push_async_backend", "threadpool")
    monkeypatch.setattr("app.services.push_dispatch.notify_session_complete", _fake_notify)

    schedule_notify_session_complete(settings, user_id=1, session_type="beat_making", duration_seconds=1200)

    assert submitted["count"] == 1
    assert calls["count"] == 1


def test_schedule_notify_session_complete_handles_executor_unavailable(monkeypatch):
    class _BrokenExecutor:
        def submit(self, _fn):
            raise RuntimeError("executor is shut down")

    monkeypatch.setattr("app.services.push_dispatch._get_push_executor", lambda _settings: _BrokenExecutor())
    monkeypatch.setattr(settings, "push_async_backend", "threadpool")
    # Should not raise.
    schedule_notify_session_complete(settings, user_id=1, session_type="beat_making", duration_seconds=900)


def test_schedule_notify_session_complete_inline_backend_executes_immediately(monkeypatch):
    calls = {"count": 0}

    def _fake_notify(*_args, **_kwargs):
        calls["count"] += 1

    monkeypatch.setattr(settings, "push_async_backend", "inline")
    monkeypatch.setattr("app.services.push_dispatch.notify_session_complete", _fake_notify)
    schedule_notify_session_complete(settings, user_id=1, session_type="beat_making", duration_seconds=300)
    assert calls["count"] == 1
