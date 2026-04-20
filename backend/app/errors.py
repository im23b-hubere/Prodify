from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class APIError(Exception):
    def __init__(self, status_code: int, message: str, code: str | None = None, details: dict[str, Any] | None = None):
        self.status_code = status_code
        self.message = message
        self.code = code or f"ERROR_{status_code}"
        self.details = details or {}
        super().__init__(message)


def error_response(
    status_code: int,
    message: str,
    code: str | None = None,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    payload: dict[str, Any] = {
        "error": {
            "code": code or f"ERROR_{status_code}",
            "message": message,
        }
    }
    if details:
        payload["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=payload)


def _normalize_http_exception_detail(detail: Any, status_code: int) -> tuple[str, str, dict[str, Any] | None]:
    if isinstance(detail, dict):
        message = str(detail.get("message") or "Request failed")
        code = str(detail.get("code") or f"ERROR_{status_code}")
        extras = {k: v for k, v in detail.items() if k not in {"message", "code"}}
        return message, code, extras or None
    if isinstance(detail, str):
        return detail, f"ERROR_{status_code}", None
    if isinstance(detail, list):
        errors: list[str] = []
        for err in detail:
            if isinstance(err, dict):
                loc = err.get("loc", ["unknown"])
                field = str(loc[-1]) if isinstance(loc, (list, tuple)) and loc else "unknown"
                msg = str(err.get("msg", "Invalid value"))
                errors.append(f"{field}: {msg}")
        message = "Validation failed: " + ("; ".join(errors) if errors else "Invalid request")
        return message, "VALIDATION_ERROR", {"errors": detail}
    return "Request failed", f"ERROR_{status_code}", None


async def api_error_handler(_: Request, exc: APIError) -> JSONResponse:
    return error_response(exc.status_code, exc.message, exc.code, exc.details)


async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    message, code, details = _normalize_http_exception_detail(exc.detail, exc.status_code)
    return error_response(exc.status_code, message, code, details)
