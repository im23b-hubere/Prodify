"""Authenticate RevenueCat webhook deliveries.

RevenueCat offers two mechanisms (https://www.revenuecat.com/docs/integrations/webhooks):
a static Authorization header value configured in the dashboard, and optional HMAC signing
via `X-RevenueCat-Webhook-Signature: t=<unix>,v1=<hex>` over "<t>.<raw body>".
A delivery is authentic when either configured mechanism verifies.
"""

import hashlib
import hmac
import time

from app.config import settings

SIGNATURE_HEADER = "X-RevenueCat-Webhook-Signature"
SIGNATURE_TOLERANCE_SECONDS = 300


def is_authentic_revenuecat_webhook(
    *,
    authorization: str | None,
    signature: str | None,
    raw_body: bytes,
) -> bool:
    return _has_valid_signature(signature, raw_body) or _has_expected_authorization(
        authorization
    )


def _has_expected_authorization(authorization: str | None) -> bool:
    expected = (settings.revenuecat_webhook_auth or "").strip()
    provided = (authorization or "").strip()
    if not expected or not provided:
        return False
    return hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8"))


def _has_valid_signature(signature: str | None, raw_body: bytes) -> bool:
    secret = (settings.revenuecat_webhook_signing_secret or "").strip()
    if not secret or not signature:
        return False
    parts = _signature_parts(signature)
    timestamp = parts.get("t", "")
    provided_digest = parts.get("v1", "")
    if not timestamp.isdigit() or not provided_digest:
        return False
    if abs(time.time() - int(timestamp)) > SIGNATURE_TOLERANCE_SECONDS:
        return False
    expected_digest = hmac.new(
        secret.encode("utf-8"), f"{timestamp}.".encode("utf-8") + raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(provided_digest, expected_digest)


def _signature_parts(signature: str) -> dict[str, str]:
    parts: dict[str, str] = {}
    for segment in signature.split(","):
        key, separator, value = segment.strip().partition("=")
        if separator:
            parts[key] = value
    return parts
