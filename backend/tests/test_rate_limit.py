from fastapi import FastAPI
from fastapi import Request
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.rate_limit import _client_ip, limiter


def _request(headers: dict[str, str], client_host: str = "10.0.0.5") -> Request:
    scope = {
        "type": "http",
        "headers": [(name.lower().encode(), value.encode()) for name, value in headers.items()],
        "client": (client_host, 0),
    }
    return Request(scope)


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


def test_client_ip_uses_edge_header_instead_of_spoofed_forwarded_for():
    request = _request(
        {
            "cf-connecting-ip": "85.0.8.42",
            "x-forwarded-for": "203.0.113.77, 85.0.8.42, 172.71.142.40",
        },
        client_host="203.0.113.77",
    )

    assert _client_ip(request) == "85.0.8.42"


def test_client_ip_ignores_invalid_edge_header(monkeypatch):
    monkeypatch.setattr(settings, "trusted_proxy_ips", [])
    request = _request({"cf-connecting-ip": "not-an-ip"}, client_host="10.0.0.5")

    assert _client_ip(request) == "10.0.0.5"


def test_client_ip_falls_back_to_peer_when_edge_header_disabled(monkeypatch):
    monkeypatch.setattr(settings, "client_ip_header", "")
    monkeypatch.setattr(settings, "trusted_proxy_ips", [])
    request = _request({"cf-connecting-ip": "85.0.8.42"}, client_host="10.0.0.5")

    assert _client_ip(request) == "10.0.0.5"
