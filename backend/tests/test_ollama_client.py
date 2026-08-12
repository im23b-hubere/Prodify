import httpx

from app.services.ollama_client import generate_weekly_coach_note


def test_generate_weekly_coach_note_decodes_success(monkeypatch):
    monkeypatch.setattr(
        "app.services.ollama_client.httpx.post",
        lambda *args, **kwargs: httpx.Response(200, json={"response": "  Keep shipping.  "}),
    )

    assert generate_weekly_coach_note("Coach me") == "Keep shipping."


def test_generate_weekly_coach_note_fails_closed_on_timeout(monkeypatch):
    def timeout(*args, **kwargs):
        raise httpx.TimeoutException("slow")

    monkeypatch.setattr("app.services.ollama_client.httpx.post", timeout)

    assert generate_weekly_coach_note("Coach me") is None


def test_generate_weekly_coach_note_fails_closed_on_provider_error(monkeypatch):
    monkeypatch.setattr(
        "app.services.ollama_client.httpx.post",
        lambda *args, **kwargs: httpx.Response(503, text="offline"),
    )

    assert generate_weekly_coach_note("Coach me") is None
