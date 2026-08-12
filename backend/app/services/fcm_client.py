"""Firebase Cloud Messaging HTTP v1 (native FCM device tokens)."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
from google.auth.transport.requests import Request
from google.oauth2 import service_account

from app.config import Settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"]


@dataclass
class FcmDelivery:
    attempted: int = 0
    delivered: int = 0
    errors: list[str] = field(default_factory=list)
    invalid_tokens: list[str] = field(default_factory=list)

    def as_tuple(self) -> tuple[int, int, str | None, list[str]]:
        summary = "; ".join(self.errors[:3]) if self.errors else None
        return self.attempted, self.delivered, summary, self.invalid_tokens


def _load_service_account_dict(settings: Settings) -> dict[str, Any] | None:
    path = (settings.firebase_service_account_path or "").strip()
    if path:
        p = Path(path)
        if p.is_file():
            return json.loads(p.read_text(encoding="utf-8"))
    raw = (settings.firebase_service_account_json or "").strip()
    if raw:
        return json.loads(raw)
    return None


def _access_token_for_fcm(settings: Settings) -> tuple[str, str] | None:
    info = _load_service_account_dict(settings)
    if not info or "project_id" not in info:
        return None
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    creds.refresh(Request())
    if not creds.token:
        return None
    return creds.token, str(info["project_id"])


def send_fcm_data_messages(
    settings: Settings,
    tokens: list[str],
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> tuple[int, int, str | None, list[str]]:
    """Send one FCM HTTP v1 request per token. Returns (attempted, ok, error_summary, invalid_tokens)."""
    if not tokens:
        return 0, 0, None, []
    auth = _access_token_for_fcm(settings)
    if not auth:
        return 0, 0, "FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH not configured", []
    access_token, project_id = auth
    url = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=UTF-8",
    }
    delivery = FcmDelivery()
    with httpx.Client(timeout=20.0) as client:
        for token in tokens[:100]:
            _send_message(client, url, headers, token, title, body, data, delivery)
    return delivery.as_tuple()


def _send_message(
    client: httpx.Client,
    url: str,
    headers: dict[str, str],
    token: str,
    title: str,
    body: str,
    data: dict[str, str] | None,
    delivery: FcmDelivery,
) -> None:
    delivery.attempted += 1
    try:
        response = client.post(
            url,
            json={"message": _message(token, title, body, data)},
            headers=headers,
        )
    except httpx.HTTPError as error:
        delivery.errors.append(str(error)[:200])
        return
    if response.status_code == 200:
        delivery.delivered += 1
        return
    detail = _response_detail(response)
    delivery.errors.append(f"{response.status_code}: {detail}"[:200])
    if _is_invalid_token_error(detail):
        delivery.invalid_tokens.append(token)


def _message(
    token: str,
    title: str,
    body: str,
    data: dict[str, str] | None,
) -> dict[str, Any]:
    message: dict[str, Any] = {
        "token": token,
        "notification": {"title": title[:128], "body": body[:256]},
        "android": {"priority": "HIGH"},
    }
    if data:
        message["data"] = {str(key): str(value) for key, value in data.items()}
    return message


def _response_detail(response: httpx.Response) -> object:
    try:
        return response.json()
    except ValueError:
        return response.text


def _is_invalid_token_error(detail: object) -> bool:
    text = str(detail)
    return "UNREGISTERED" in text or "registration-token-not-registered" in text
