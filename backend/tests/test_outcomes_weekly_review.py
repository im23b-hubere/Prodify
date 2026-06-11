def _auth_headers(client, email: str, username: str, password: str = "strong-pass-123") -> dict[str, str]:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert register.status_code == 201
    token = register.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_weekly_review_generate_and_fetch(client):
    headers = _auth_headers(client, "review@example.com", "review-user")
    generated = client.post("/outcomes/weekly-review/generate", headers=headers)
    assert generated.status_code == 200
    body = generated.json()
    assert "suggestions" in body
    assert len(body["suggestions"]) == 3
    current = client.get("/outcomes/weekly-review/current", headers=headers)
    assert current.status_code == 200


def test_weekly_review_generate_uses_ollama_when_available(client, monkeypatch):
    from app.services import weekly_review_service

    monkeypatch.setattr(
        weekly_review_service,
        "generate_weekly_coach_note",
        lambda _prompt: "Stay consistent and protect your best hour this week.",
    )

    headers = _auth_headers(client, "review-ollama@example.com", "review-ollama-user")
    generated = client.post("/outcomes/weekly-review/generate", headers=headers)
    assert generated.status_code == 200
    body = generated.json()
    assert body["ai_feedback"] == "Stay consistent and protect your best hour this week."


def test_weekly_review_generate_ai_timeout_falls_back_without_500(client, monkeypatch):
    from app.services import weekly_review_service

    monkeypatch.setattr(weekly_review_service, "generate_weekly_coach_note", lambda _prompt: None)

    headers = _auth_headers(client, "review-timeout@example.com", "review-timeout-user")
    generated = client.post("/outcomes/weekly-review/generate", headers=headers)
    assert generated.status_code == 200
    body = generated.json()
    assert isinstance(body["ai_feedback"], str)
    assert body["ai_feedback"]


def test_weekly_review_generate_logs_provider_errors_and_uses_fallback(client, monkeypatch, caplog):
    from app.services import weekly_review_service

    def _raise(_prompt: str) -> str:
        raise RuntimeError("provider down")

    monkeypatch.setattr(weekly_review_service, "generate_weekly_coach_note", _raise)

    headers = _auth_headers(client, "review-provider@example.com", "review-provider-user")
    with caplog.at_level("ERROR"):
        generated = client.post("/outcomes/weekly-review/generate", headers=headers)
    assert generated.status_code == 200
    body = generated.json()
    assert isinstance(body["ai_feedback"], str)
    assert body["ai_feedback"]
    assert any("weekly_review_ai_provider_error" in record.message for record in caplog.records)


def test_output_metrics_current_returns_shape(client):
    headers = _auth_headers(client, "metrics@example.com", "metrics-user")
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    started = client.post("/sessions/start", headers=headers, json={"session_type": "beat_making"})
    assert started.status_code == 201
    sid = started.json()["id"]
    stopped = client.post("/sessions/stop", headers=headers, json={"session_id": sid})
    assert stopped.status_code == 200
    patched = client.patch(
        f"/sessions/item/{sid}",
        headers=headers,
        json={"track_outcome": "finished", "track_title": "Skyline"},
    )
    assert patched.status_code == 200

    metrics = client.get("/outcomes/output-metrics/current", headers=headers)
    assert metrics.status_code == 200
    body = metrics.json()
    assert body["tracks_finished_30d"] >= 1
    assert body["productivity_trend"] in ("up", "down", "stable")
    assert "avg_completion_time_days" in body
    assert "output_increase" in body
    assert "baseline_tracks_30d" in body

