import httpx

from app.config import settings
from app.services import fcm_client


class _Response:
    def __init__(self, status_code: int, detail=None, text: str = ""):
        self.status_code = status_code
        self._detail = detail
        self.text = text

    def json(self):
        if self._detail is None:
            raise ValueError("not json")
        return self._detail


class _Client:
    def __init__(self, responses):
        self._responses = iter(responses)
        self.requests = []

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def post(self, url, *, json, headers):
        self.requests.append((url, json, headers))
        response = next(self._responses)
        if isinstance(response, Exception):
            raise response
        return response


def test_send_fcm_data_messages_returns_early_without_tokens(monkeypatch):
    monkeypatch.setattr(fcm_client, "_access_token_for_fcm", lambda _settings: (_ for _ in ()).throw(AssertionError()))
    assert fcm_client.send_fcm_data_messages(settings, [], "Title", "Body") == (0, 0, None, [])


def test_send_fcm_data_messages_reports_delivery_and_invalid_tokens(monkeypatch):
    fake_client = _Client(
        [
            _Response(200, {"name": "ok"}),
            _Response(404, {"error": {"status": "UNREGISTERED"}}),
            httpx.ConnectError("offline"),
        ]
    )
    monkeypatch.setattr(fcm_client, "_access_token_for_fcm", lambda _settings: ("access", "project"))
    monkeypatch.setattr(fcm_client.httpx, "Client", lambda **_kwargs: fake_client)

    result = fcm_client.send_fcm_data_messages(
        settings,
        ["valid", "invalid", "offline"],
        "T" * 140,
        "B" * 270,
        data={"count": 2},
    )

    attempted, delivered, summary, invalid_tokens = result
    assert attempted == 3
    assert delivered == 1
    assert invalid_tokens == ["invalid"]
    assert "UNREGISTERED" in (summary or "")
    assert "offline" in (summary or "")
    sent_message = fake_client.requests[0][1]["message"]
    assert len(sent_message["notification"]["title"]) == 128
    assert len(sent_message["notification"]["body"]) == 256
    assert sent_message["data"] == {"count": "2"}
