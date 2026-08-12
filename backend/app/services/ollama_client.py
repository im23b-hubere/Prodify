from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OllamaRequest:
    url: str
    model: str
    body: dict[str, Any]
    timeout_seconds: float


def _generate_text(
    prompt: str,
    *,
    num_predict: int,
    temperature: float,
    label: str,
) -> str | None:
    """Generate text via local Ollama with tuned options.

    Returns None when Ollama is unavailable or the response is empty.
    """
    request = _build_request(prompt, num_predict=num_predict, temperature=temperature)
    if request is None:
        return None
    response = _post(request, label)
    return _response_text(response, request.model, label) if response is not None else None


def _build_request(prompt: str, *, num_predict: int, temperature: float) -> OllamaRequest | None:
    base_url = (settings.ollama_base_url or "").strip()
    if not base_url:
        return None
    model = (settings.ollama_model or "").strip() or "llama3.1:8b"
    return OllamaRequest(
        url=f"{base_url.rstrip('/')}/api/generate",
        model=model,
        body={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": float(temperature),
                "num_predict": int(num_predict),
            },
        },
        timeout_seconds=float(settings.ollama_timeout_seconds or 20.0),
    )


def _post(request: OllamaRequest, label: str) -> httpx.Response | None:
    try:
        return httpx.post(request.url, json=request.body, timeout=request.timeout_seconds)
    except httpx.TimeoutException:
        logger.warning(
            "Ollama %s timeout",
            label,
            extra={
                "provider": "ollama",
                "label": label,
                "timeout_seconds": request.timeout_seconds,
            },
        )
    except httpx.HTTPError as exc:
        logger.warning(
            "Ollama %s transport error: %s",
            label,
            exc,
            extra={"provider": "ollama", "label": label},
        )
    return None


def _response_text(response: httpx.Response, model: str, label: str) -> str | None:
    if response.status_code >= 400:
        snippet = (response.text or "").strip().replace("\n", " ")[:300]
        logger.warning(
            "Ollama %s HTTP %s (%s): %s",
            label,
            response.status_code,
            model,
            snippet,
        )
        return None

    try:
        payload = response.json()
    except ValueError:
        logger.warning("Ollama %s returned invalid JSON", label)
        return None
    text = str(payload.get("response") or "").strip()
    return text or None


def generate_weekly_coach_note(prompt: str) -> str | None:
    return _generate_text(
        prompt,
        num_predict=110,
        temperature=0.5,
        label="weekly_coach",
    )
