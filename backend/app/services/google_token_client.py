"""Revoke a stored Google token when an account is deleted.

Google sign-in normally leaves no refresh token. When one was stored, revocation is best
effort: a Google outage must not trap the account.
"""

import logging

import httpx

logger = logging.getLogger(__name__)

GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
_REQUEST_TIMEOUT_SECONDS = 10.0


def revoke_token(token: str) -> None:
    try:
        httpx.post(
            GOOGLE_REVOKE_URL,
            data={"token": token},
            timeout=_REQUEST_TIMEOUT_SECONDS,
        ).raise_for_status()
    except httpx.HTTPError:
        logger.warning("google_token_revoke_failed")
