"""Optional Sentry and JSON logging for production operations."""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from app.config import settings


class JsonLogFormatter(logging.Formatter):
    """One JSON object per line (easy to ship to log aggregators)."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def setup_logging() -> None:
    if not settings.log_json:
        return
    root = logging.getLogger()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonLogFormatter())
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)


def init_sentry() -> None:
    dsn = (settings.sentry_dsn or "").strip()
    if not dsn:
        return
    if "://" not in dsn:
        logging.getLogger(__name__).warning(
            "Skipping Sentry init because SENTRY_DSN is invalid (missing URL scheme)."
        )
        return

    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    try:
        sentry_sdk.init(
            dsn=dsn,
            environment=settings.environment,
            release=settings.app_version,
            send_default_pii=False,
            integrations=[
                StarletteIntegration(transaction_style="endpoint"),
                FastApiIntegration(),
            ],
            traces_sample_rate=settings.sentry_traces_sample_rate if settings.environment == "production" else 0.0,
        )
    except Exception as exc:  # pragma: no cover - defensive startup guard
        logging.getLogger(__name__).warning("Skipping Sentry init due to invalid DSN/config: %s", exc)


def init_observability() -> None:
    setup_logging()
    init_sentry()
