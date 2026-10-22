import json
from datetime import datetime, timezone

import httpx
import requests

from app.config import settings
from app.database import SessionLocal
from app.models import GrowthEvent, ProductionSession, SessionAreaWeight, SocialProvider, User, UserIdentity
from app.services.object_storage import ObjectStorageError
from app.services.social_identity_service import VerifiedIdentity
from app.routers import auth as auth_router

FAKE_TOKEN = "x" * 40


def test_deleting_a_google_account_without_a_token_starts_fresh(client, monkeypatch, caplog):
    _stub_google(monkeypatch, subject="google-delete-1", email="google-delete@example.com")
    first = client.post("/auth/google", json={"id_token": FAKE_TOKEN})
    assert first.status_code == 200
    headers = {"Authorization": f"Bearer {first.json()['access_token']}"}
    me = client.get("/auth/me", headers=headers).json()
    user_id = me["id"]
    session_id = _store_session(user_id)
    with SessionLocal() as db:
        db.get(User, user_id).timezone = "Europe/Zurich"
        db.commit()

    with caplog.at_level("INFO"):
        deleted = client.delete("/users/me", headers=headers)

    assert deleted.status_code == 204
    assert any("google_revoke_skipped_no_token" in record.message for record in caplog.records)
    second = client.post("/auth/google", json={"id_token": FAKE_TOKEN})
    assert second.status_code == 200
    fresh = client.get("/auth/me", headers={"Authorization": f"Bearer {second.json()['access_token']}"}).json()
    assert fresh["timezone"] is None
    with SessionLocal() as db:
        assert db.query(ProductionSession).filter(ProductionSession.user_id == fresh["id"]).count() == 0
        assert db.query(SessionAreaWeight).filter(SessionAreaWeight.session_id == session_id).count() == 0


def test_stored_google_token_is_revoked_before_the_account_goes(client, monkeypatch):
    _stub_google(monkeypatch, subject="google-revoke-1", email="google-revoke@example.com")
    signed_in = client.post("/auth/google", json={"id_token": FAKE_TOKEN})
    headers = {"Authorization": f"Bearer {signed_in.json()['access_token']}"}
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    with SessionLocal() as db:
        identity = db.query(UserIdentity).filter(UserIdentity.user_id == user_id).one()
        identity.provider_refresh_token = "google-refresh-token"
        db.commit()
    revoked = []

    def capture(url, data=None, params=None, timeout=None):
        revoked.append({"url": url, "params": params, "data": data})

        class Response:
            def raise_for_status(self):
                return None

        return Response()

    monkeypatch.setattr(httpx, "post", capture)

    deleted = client.delete("/users/me", headers=headers)

    assert deleted.status_code == 204
    assert any(
        call["url"] == "https://oauth2.googleapis.com/revoke" and "google-refresh-token" in str(call)
        for call in revoked
    )
    with SessionLocal() as db:
        assert db.get(User, user_id) is None


def test_review_share_image_is_removed_and_a_storage_failure_keeps_the_account(client, monkeypatch):
    headers, user_id = _password_user(client, "share-image@example.com", "share-image")
    monkeypatch.setattr(settings, "object_storage_public_base_url", "https://media.prodify.app")
    with SessionLocal() as db:
        from app.models import WeeklyReviewSnapshot

        db.add(
            WeeklyReviewSnapshot(
                user_id=user_id,
                week_start="2026-10-12",
                week_end="2026-10-18",
                share_image_url="https://media.prodify.app/weekly_reviews/7.png",
            )
        )
        db.commit()
    deleted_keys = []

    def record(key):
        deleted_keys.append(key)

    monkeypatch.setattr("app.services.object_storage._delete_remote", record)
    deleted = client.delete("/users/me", headers=headers)

    assert deleted.status_code == 204
    assert deleted_keys == ["weekly_reviews/7.png"]

    headers, user_id = _password_user(client, "share-image-fail@example.com", "share-fail")
    monkeypatch.setattr(settings, "object_storage_public_base_url", "https://media.prodify.app")
    with SessionLocal() as db:
        from app.models import WeeklyReviewSnapshot

        db.add(
            WeeklyReviewSnapshot(
                user_id=user_id,
                week_start="2026-10-12",
                week_end="2026-10-18",
                share_image_url="https://media.prodify.app/weekly_reviews/8.png",
            )
        )
        db.commit()

    def explode(key):
        raise ObjectStorageError("storage down")

    monkeypatch.setattr("app.services.object_storage._delete_remote", explode)
    failed = client.delete("/users/me", headers=headers)

    assert failed.status_code == 502
    with SessionLocal() as db:
        assert db.get(User, user_id) is not None


def test_revenuecat_subscriber_is_deleted_and_a_failure_keeps_the_account(client, monkeypatch):
    headers, user_id = _password_user(client, "rc-delete@example.com", "rc-delete")
    monkeypatch.setattr(settings, "revenuecat_secret_key", "sk_test_secret")
    calls = []

    def ok_delete(url, headers=None, timeout=None):
        calls.append(url)

        class Response:
            status_code = 200

            def raise_for_status(self):
                return None

        return Response()

    monkeypatch.setattr("app.services.subscription_service.requests.delete", ok_delete)
    deleted = client.delete("/users/me", headers=headers)

    assert deleted.status_code == 204
    assert calls == [f"https://api.revenuecat.com/v1/subscribers/{user_id}"]
    with SessionLocal() as db:
        assert db.get(User, user_id) is None

    headers, user_id = _password_user(client, "rc-fail@example.com", "rc-fail")
    monkeypatch.setattr(settings, "revenuecat_secret_key", "sk_test_secret")

    def fail_delete(url, headers=None, timeout=None):
        raise requests.HTTPError("revenuecat down")

    monkeypatch.setattr("app.services.subscription_service.requests.delete", fail_delete)
    failed = client.delete("/users/me", headers=headers)

    assert failed.status_code == 502
    with SessionLocal() as db:
        assert db.get(User, user_id) is not None


def test_anonymous_growth_event_that_names_the_user_is_removed(client):
    headers, user_id = _password_user(client, "anon-event@example.com", "anon-event")
    with SessionLocal() as db:
        user = db.get(User, user_id)
        db.add(
            GrowthEvent(
                user_id=None,
                event_name="orphan",
                event_props_json=json.dumps({"email": user.email}),
            )
        )
        db.add(
            GrowthEvent(
                user_id=None,
                event_name="unrelated",
                event_props_json=json.dumps({"source": "cron"}),
            )
        )
        db.commit()

    assert client.delete("/users/me", headers=headers).status_code == 204

    with SessionLocal() as db:
        remaining = {
            row.event_name
            for row in db.query(GrowthEvent).filter(GrowthEvent.user_id.is_(None)).all()
        }
    assert "orphan" not in remaining
    assert "unrelated" in remaining


def _stub_google(monkeypatch, *, subject: str, email: str) -> None:
    identity = VerifiedIdentity(
        provider=SocialProvider.google,
        subject=subject,
        email=email,
        is_email_verified=True,
    )
    monkeypatch.setattr(settings, "google_client_ids", "web-client.apps.googleusercontent.com")
    monkeypatch.setattr(auth_router, "verify_google_id_token", lambda token, audiences: identity)


def _password_user(client, email: str, username: str) -> tuple[dict[str, str], int]:
    from tests.auth_helpers import auth_headers

    headers = auth_headers(client, email, username)
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    return headers, me.json()["id"]


def _store_session(user_id: int) -> int:
    with SessionLocal() as db:
        session = ProductionSession(
            user_id=user_id,
            started_at=datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc),
            stopped_at=datetime(2026, 10, 21, 12, 30, tzinfo=timezone.utc),
            duration_seconds=1800,
            session_type="beat_making",
        )
        db.add(session)
        db.flush()
        session_id = session.id
        db.add(SessionAreaWeight(session_id=session_id, branch="beat_making", weight=1))
        db.commit()
        return session_id
