"""Sign in with Apple REST calls: exchange the device authorization code and revoke on deletion.

Both calls are best effort. Sign-in must keep working when Apple is slow or the key is not
configured; deletion must never be blocked by Apple being unreachable.
"""

import logging
import time

import httpx
import jwt

from app.config import settings
from app.services.social_identity_service import APPLE_ISSUER

_log = logging.getLogger(__name__)
_REQUEST_TIMEOUT_SECONDS = 10.0
_CLIENT_SECRET_LIFETIME_SECONDS = 300
# Network failures, a malformed private key (ValueError/PyJWTError while signing the client
# secret) and non-JSON responses (ValueError) must all degrade to "no Apple token".
_BEST_EFFORT_ERRORS = (httpx.HTTPError, jwt.PyJWTError, ValueError)


def is_apple_revocation_configured() -> bool:
    return all(
        (value or "").strip()
        for value in (settings.apple_team_id, settings.apple_key_id, settings.apple_private_key)
    )


def exchange_authorization_code(authorization_code: str, client_id: str) -> str | None:
    """Returns the Apple refresh token for the code, or None when unavailable."""
    if not is_apple_revocation_configured():
        return None
    try:
        response = httpx.post(
            f"{APPLE_ISSUER}/auth/token",
            data={
                "client_id": client_id,
                "client_secret": _client_secret(client_id),
                "code": authorization_code,
                "grant_type": "authorization_code",
            },
            timeout=_REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
    except _BEST_EFFORT_ERRORS:
        _log.warning("apple_code_exchange_failed", exc_info=True)
        return None
    refresh_token = payload.get("refresh_token") if isinstance(payload, dict) else None
    return refresh_token if isinstance(refresh_token, str) and refresh_token else None


def revoke_refresh_token(refresh_token: str, client_id: str) -> None:
    if not is_apple_revocation_configured():
        return
    try:
        httpx.post(
            f"{APPLE_ISSUER}/auth/revoke",
            data={
                "client_id": client_id,
                "client_secret": _client_secret(client_id),
                "token": refresh_token,
                "token_type_hint": "refresh_token",
            },
            timeout=_REQUEST_TIMEOUT_SECONDS,
        ).raise_for_status()
    except _BEST_EFFORT_ERRORS:
        _log.warning("apple_token_revoke_failed", exc_info=True)


def _client_secret(client_id: str) -> str:
    issued_at = int(time.time())
    private_key = (settings.apple_private_key or "").replace("\\n", "\n")
    return jwt.encode(
        {
            "iss": settings.apple_team_id,
            "iat": issued_at,
            "exp": issued_at + _CLIENT_SECRET_LIFETIME_SECONDS,
            "aud": APPLE_ISSUER,
            "sub": client_id,
        },
        private_key,
        algorithm="ES256",
        headers={"kid": settings.apple_key_id},
    )
