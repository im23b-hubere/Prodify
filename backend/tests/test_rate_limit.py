from fastapi import FastAPI
from fastapi import Request
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.rate_limit import limiter


def _build_app() -> FastAPI:
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @app.post("/limited")
    @limiter.limit("2/minute")
    def limited_endpoint(request: Request):
        return {"ok": True}

    return app


def test_rate_limit_exceeded_returns_429():
    app = _build_app()
    with TestClient(app) as client:
        first = client.post("/limited")
        second = client.post("/limited")
        third = client.post("/limited")

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
