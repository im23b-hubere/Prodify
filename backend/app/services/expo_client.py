"""HTTP client for Expo Push API."""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_expo_batch(access_token: str, messages: list[dict]) -> tuple[int, int, str | None]:
    """Returns (attempted, ok_count, error_summary)."""
    if not messages:
        return 0, 0, None
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token.strip()}",
    }
    try:
        resp = httpx.post(EXPO_PUSH_URL, json={"messages": messages}, headers=headers, timeout=20.0)
        resp.raise_for_status()
    except httpx.HTTPError as e:
        logger.warning("Expo push HTTP error: %s", e)
        return len(messages), 0, str(e)

    try:
        payload = resp.json()
    except ValueError:
        return len(messages), 0, "invalid JSON from Expo"

    data = payload.get("data")
    if not isinstance(data, list):
        return len(messages), 0, "unexpected Expo response"

    ok = 0
    errs: list[str] = []
    for item in data:
        if isinstance(item, dict) and item.get("status") == "ok":
            ok += 1
        elif isinstance(item, dict):
            errs.append(str(item.get("message", item)))
    summary = "; ".join(errs[:3]) if errs else None
    return len(messages), ok, summary
