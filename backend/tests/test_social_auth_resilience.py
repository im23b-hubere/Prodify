"""Sign-in and account deletion must survive Apple/Google outages and a misconfigured Apple key."""

from types import SimpleNamespace

import httpx
import pytest
from google.auth.exceptions import TransportError

from app.config import settings
from app.database import SessionLocal
from app.models import SocialProvider, UserIdentity
from app.routers import auth as auth_router
from app.services import apple_token_client, social_identity_service
from app.services.social_identity_service import (
    SocialProviderUnavailableError,
    VerifiedIdentity,
    verify_google_id_token,
)

FAKE_TOKEN = "header.payload.signature"


@pytest.fixture
def apple_revocation_with_broken_key(monkeypatch):
    monkeypatch.setattr(settings, "apple_team_id", "TEAM123")
    monkeypatch.setattr(settings, "apple_key_id", "KEY123")
    monkeypatch.setattr(settings, "apple_private_key", "not-a-pem-key")


@pytest.fixture
def apple_identity(monkeypatch):
    identity = VerifiedIdentity(SocialProvider.apple, "apple-sub-1", "artist@example.com", True)
    monkeypatch.setattr(auth_router, "verify_apple_identity_token", lambda token, audiences: identity)


def test_misconfigured_apple_key_does_not_block_account_deletion(
    client, apple_identity, apple_revocation_with_broken_key
):
    tokens = client.post("/auth/apple", json={"identity_token": FAKE_TOKEN}).json()
    with SessionLocal() as db:
        db.query(UserIdentity).one().provider_refresh_token = "apple-refresh-token"
        db.commit()

    response = client.delete("/users/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})

    assert response.status_code == 204


def test_misconfigured_apple_key_does_not_break_apple_sign_in(
    client, apple_identity, apple_revocation_with_broken_key
):
    response = client.post(
        "/auth/apple", json={"identity_token": FAKE_TOKEN, "authorization_code": "device-code"}
    )

    assert response.status_code == 200


def test_unexpected_apple_response_body_is_ignored(monkeypatch):
    monkeypatch.setattr(apple_token_client, "is_apple_revocation_configured", lambda: True)
    monkeypatch.setattr(apple_token_client, "_client_secret", lambda client_id: "secret")
    request = httpx.Request("POST", "https://appleid.apple.com/auth/token")
    monkeypatch.setattr(
        apple_token_client.httpx,
        "post",
        lambda *args, **kwargs: httpx.Response(200, text="<html>maintenance</html>", request=request),
    )

    assert apple_token_client.exchange_authorization_code("code", "com.prodify.app") is None


def test_google_certificate_outage_is_reported_as_provider_unavailable(monkeypatch):
    def outage(*args, **kwargs):
        raise TransportError("certificates unreachable")

    monkeypatch.setattr(social_identity_service.google_id_token, "verify_oauth2_token", outage)

    with pytest.raises(SocialProviderUnavailableError):
        verify_google_id_token(FAKE_TOKEN, ["web-client.apps.googleusercontent.com"])


def test_google_outage_returns_503_instead_of_server_error(client, monkeypatch):
    monkeypatch.setattr(settings, "google_client_ids", "web-client.apps.googleusercontent.com")

    def outage(token, audiences):
        raise SocialProviderUnavailableError("google unreachable")

    monkeypatch.setattr(auth_router, "verify_google_id_token", outage)

    response = client.post("/auth/google", json={"id_token": FAKE_TOKEN})

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SOCIAL_PROVIDER_UNAVAILABLE"


def test_google_tokens_tolerate_small_clock_skew(monkeypatch):
    received = SimpleNamespace(kwargs=None)

    def verify(token, transport, **kwargs):
        received.kwargs = kwargs
        return {"sub": "google-sub", "email": "a@example.com", "email_verified": True}

    monkeypatch.setattr(social_identity_service.google_id_token, "verify_oauth2_token", verify)

    verify_google_id_token(FAKE_TOKEN, ["web-client.apps.googleusercontent.com"])

    assert received.kwargs["clock_skew_in_seconds"] > 0
