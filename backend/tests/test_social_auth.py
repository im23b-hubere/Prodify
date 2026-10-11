import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.config import settings
from app.models import SocialProvider
from app.routers import auth as auth_router
from app.services import social_identity_service
from app.services.social_identity_service import (
    SocialTokenRejectedError,
    VerifiedIdentity,
    verify_apple_identity_token,
)

FAKE_TOKEN = "x" * 40


def _identity(provider=SocialProvider.apple, subject="apple-sub-1", email="artist@example.com", verified=True):
    return VerifiedIdentity(provider=provider, subject=subject, email=email, is_email_verified=verified)


@pytest.fixture
def apple_identity(monkeypatch):
    holder = {"identity": _identity()}
    monkeypatch.setattr(auth_router, "verify_apple_identity_token", lambda token, audiences: holder["identity"])
    return holder


@pytest.fixture
def google_identity(monkeypatch):
    holder = {"identity": _identity(provider=SocialProvider.google, subject="google-sub-1")}
    monkeypatch.setattr(settings, "google_client_ids", "web-client.apps.googleusercontent.com")
    monkeypatch.setattr(auth_router, "verify_google_id_token", lambda token, audiences: holder["identity"])
    return holder


def _me(client, access_token):
    return client.get("/auth/me", headers={"Authorization": f"Bearer {access_token}"}).json()


def test_apple_sign_in_creates_account_with_username_from_given_name(client, apple_identity):
    response = client.post("/auth/apple", json={"identity_token": FAKE_TOKEN, "given_name": "Kenny Beats"})

    assert response.status_code == 200
    me = _me(client, response.json()["access_token"])
    assert me["email"] == "artist@example.com"
    assert me["username"] == "kennybeats"


def test_repeat_apple_sign_in_returns_the_same_account(client, apple_identity):
    first = client.post("/auth/apple", json={"identity_token": FAKE_TOKEN})
    apple_identity["identity"] = _identity(email=None)
    second = client.post("/auth/apple", json={"identity_token": FAKE_TOKEN})

    assert second.status_code == 200
    assert _me(client, first.json()["access_token"])["id"] == _me(client, second.json()["access_token"])["id"]


def test_google_sign_in_links_existing_password_account_with_verified_email(client, google_identity):
    register = client.post(
        "/auth/register",
        json={"email": "artist@example.com", "username": "artist", "password": "strong-pass-123"},
    )

    response = client.post("/auth/google", json={"id_token": FAKE_TOKEN})

    assert response.status_code == 200
    assert _me(client, response.json()["access_token"])["id"] == _me(client, register.json()["access_token"])["id"]


def test_unverified_email_never_takes_over_existing_account(client, google_identity):
    client.post(
        "/auth/register",
        json={"email": "artist@example.com", "username": "artist", "password": "strong-pass-123"},
    )
    google_identity["identity"] = _identity(provider=SocialProvider.google, subject="g-2", verified=False)

    response = client.post("/auth/google", json={"id_token": FAKE_TOKEN})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_TAKEN"


def test_new_account_without_email_is_rejected(client, apple_identity):
    apple_identity["identity"] = _identity(email=None)

    response = client.post("/auth/apple", json={"identity_token": FAKE_TOKEN})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "SOCIAL_EMAIL_REQUIRED"


def test_username_collision_gets_a_numeric_suffix(client, apple_identity):
    client.post(
        "/auth/register",
        json={"email": "someone@example.com", "username": "artist", "password": "strong-pass-123"},
    )

    response = client.post("/auth/apple", json={"identity_token": FAKE_TOKEN})

    username = _me(client, response.json()["access_token"])["username"]
    assert username.startswith("artist") and username != "artist"


def test_social_only_account_cannot_sign_in_with_password(client, apple_identity):
    client.post("/auth/apple", json={"identity_token": FAKE_TOKEN})

    response = client.post("/auth/login", json={"email": "artist@example.com", "password": "anything-123"})

    assert response.status_code == 401


def test_rejected_token_returns_social_token_invalid(client, monkeypatch):
    def reject(token, audiences):
        raise SocialTokenRejectedError("bad")

    monkeypatch.setattr(auth_router, "verify_apple_identity_token", reject)

    response = client.post("/auth/apple", json={"identity_token": FAKE_TOKEN})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "SOCIAL_TOKEN_INVALID"


def test_google_sign_in_unavailable_without_client_ids(client, monkeypatch):
    monkeypatch.setattr(settings, "google_client_ids", "")

    response = client.post("/auth/google", json={"id_token": FAKE_TOKEN})

    assert response.status_code == 503


def test_deleting_social_account_lets_the_same_apple_id_start_fresh(client, apple_identity):
    first = client.post("/auth/apple", json={"identity_token": FAKE_TOKEN})
    client.put(
        "/users/me/timezone",
        json={"timezone": "Europe/Berlin"},
        headers={"Authorization": f"Bearer {first.json()['access_token']}"},
    )

    deleted = client.delete("/users/me", headers={"Authorization": f"Bearer {first.json()['access_token']}"})
    second = client.post("/auth/apple", json={"identity_token": FAKE_TOKEN})

    assert deleted.status_code == 204
    assert second.status_code == 200
    assert _me(client, second.json()["access_token"])["timezone"] is None


class TestAppleIdentityTokenVerification:
    @pytest.fixture
    def signing_key(self, monkeypatch):
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        monkeypatch.setattr(
            social_identity_service,
            "_apple_signing_keys",
            SimpleNamespace(get_signing_key_from_jwt=lambda token: SimpleNamespace(key=private_key.public_key())),
        )
        return private_key

    def _token(self, private_key, **overrides):
        now = int(time.time())
        claims = {
            "iss": "https://appleid.apple.com",
            "aud": "com.prodify.app",
            "sub": "001234.abc",
            "iat": now,
            "exp": now + 600,
            "email": "Artist@Example.com",
            "email_verified": "true",
            **overrides,
        }
        return jwt.encode(claims, private_key, algorithm="RS256")

    def test_valid_token_yields_identity(self, signing_key):
        identity = verify_apple_identity_token(self._token(signing_key), ["com.prodify.app"])

        assert identity == VerifiedIdentity(SocialProvider.apple, "001234.abc", "artist@example.com", True)

    def test_token_for_another_app_is_rejected(self, signing_key):
        with pytest.raises(SocialTokenRejectedError):
            verify_apple_identity_token(self._token(signing_key, aud="com.other.app"), ["com.prodify.app"])

    def test_expired_token_is_rejected(self, signing_key):
        with pytest.raises(SocialTokenRejectedError):
            verify_apple_identity_token(self._token(signing_key, exp=int(time.time()) - 60), ["com.prodify.app"])
