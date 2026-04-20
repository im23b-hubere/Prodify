"""Firebase Cloud Messaging HTTP v1 (native FCM device tokens)."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import httpx
from google.auth.transport.requests import Request
from google.oauth2 import service_account

from app.config import Settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"]


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

    if not tokens:
        return 0, 0, None, []

    url = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=UTF-8",
    }

    ok = 0
    errs: list[str] = []
    invalid_tokens: list[str] = []
    attempted = 0
    with httpx.Client(timeout=20.0) as client:
        for t in tokens[:100]:
            attempted += 1
            msg: dict[str, Any] = {
                "token": t,
                "notification": {"title": title[:128], "body": body[:256]},
                "android": {"priority": "HIGH"},
            }
            if data:
                msg["data"] = {str(k): str(v) for k, v in data.items()}
            payload = {"message": msg}
            try:
                r = client.post(url, json=payload, headers=headers)
                if r.status_code == 200:
                    ok += 1
                else:
                    try:
                        detail = r.json()
                    except ValueError:
                        detail = r.text
                    errs.append(f"{r.status_code}: {detail}"[:200])
                    detail_text = str(detail)
                    if "UNREGISTERED" in detail_text or "registration-token-not-registered" in detail_text:
                        invalid_tokens.append(t)
            except httpx.HTTPError as e:
                errs.append(str(e)[:200])

    summary = "; ".join(errs[:3]) if errs else None
    return attempted, ok, summary, invalid_tokens
