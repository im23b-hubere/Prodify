from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


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
    base_url = (settings.ollama_base_url or "").strip()
    if not base_url:
        return None

    model = (settings.ollama_model or "").strip() or "llama3.1:8b"
    url = f"{base_url.rstrip('/')}/api/generate"
    body = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": float(temperature),
            "num_predict": int(num_predict),
        },
    }

    timeout_seconds = float(settings.ollama_timeout_seconds or 20.0)
    try:
        resp = httpx.post(url, json=body, timeout=timeout_seconds)
    except httpx.TimeoutException:
        logger.warning(
            "Ollama %s timeout",
            label,
            extra={"provider": "ollama", "label": label, "timeout_seconds": timeout_seconds},
        )
        return None
    except httpx.HTTPError as exc:
        logger.warning(
            "Ollama %s transport error: %s",
            label,
            exc,
            extra={"provider": "ollama", "label": label},
        )
        return None

    if resp.status_code >= 400:
        snippet = (resp.text or "").strip().replace("\n", " ")[:300]
        logger.warning(
            "Ollama %s HTTP %s (%s): %s",
            label,
            resp.status_code,
            model,
            snippet,
        )
        return None

    try:
        payload = resp.json()
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


def generate_stats_chat_reply(prompt: str) -> str | None:
    return _generate_text(
        prompt,
        num_predict=96,
        temperature=0.25,
        label="stats_chat",
    )
