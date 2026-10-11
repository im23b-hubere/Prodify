"""Verify ID tokens issued by Sign in with Apple and Google Sign-In."""

from dataclasses import dataclass

import jwt
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.models import SocialProvider

APPLE_ISSUER = "https://appleid.apple.com"
_apple_signing_keys = jwt.PyJWKClient(f"{APPLE_ISSUER}/auth/keys", cache_keys=True)
_google_transport = google_requests.Request()


class SocialTokenRejectedError(ValueError):
    pass


@dataclass(frozen=True)
class VerifiedIdentity:
    provider: SocialProvider
    subject: str
    email: str | None
    is_email_verified: bool


def verify_apple_identity_token(identity_token: str, bundle_ids: list[str]) -> VerifiedIdentity:
    try:
        signing_key = _apple_signing_keys.get_signing_key_from_jwt(identity_token)
        claims = jwt.decode(
            identity_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=bundle_ids,
            issuer=APPLE_ISSUER,
            options={"require": ["sub", "exp", "iat"]},
        )
    except jwt.PyJWTError as error:
        raise SocialTokenRejectedError("apple identity token rejected") from error
    return VerifiedIdentity(
        provider=SocialProvider.apple,
        subject=str(claims["sub"]),
        email=_normalized_email(claims.get("email")),
        # Apple encodes booleans as either JSON booleans or the strings "true"/"false".
        is_email_verified=str(claims.get("email_verified", "")).lower() == "true",
    )


def verify_google_id_token(id_token: str, client_ids: list[str]) -> VerifiedIdentity:
    try:
        claims = google_id_token.verify_oauth2_token(id_token, _google_transport, audience=client_ids)
    except ValueError as error:
        raise SocialTokenRejectedError("google id token rejected") from error
    if not claims.get("sub"):
        raise SocialTokenRejectedError("google id token has no subject")
    return VerifiedIdentity(
        provider=SocialProvider.google,
        subject=str(claims["sub"]),
        email=_normalized_email(claims.get("email")),
        is_email_verified=bool(claims.get("email_verified")),
    )


def _normalized_email(raw: object) -> str | None:
    if not isinstance(raw, str) or not raw.strip():
        return None
    return raw.strip().lower()
