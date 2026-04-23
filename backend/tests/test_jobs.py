import json


def test_streak_reminders_job_requires_configured_key(client, monkeypatch):
    monkeypatch.setattr("app.routers.jobs.settings.internal_job_key", None)
    response = client.post("/jobs/streak-reminders")

    assert response.status_code == 503
    assert "job_key_not_configured" in json.dumps(response.json()).lower()


def test_streak_reminders_job_rejects_invalid_key(client, monkeypatch):
    monkeypatch.setattr("app.routers.jobs.settings.internal_job_key", "expected-key-123456789")
    response = client.post(
        "/jobs/streak-reminders",
        headers={"X-Internal-Job-Key": "wrong-key"},
    )

    assert response.status_code == 401
    assert "invalid_job_key" in json.dumps(response.json()).lower()


def test_streak_reminders_job_accepts_valid_key(client, monkeypatch):
    monkeypatch.setattr("app.routers.jobs.settings.internal_job_key", "expected-key-123456789")
    monkeypatch.setattr(
        "app.routers.jobs.run_streak_reminder_job",
        lambda db, settings: {"sent": 0, "dry_run": False},
    )

    response = client.post(
        "/jobs/streak-reminders",
        headers={"X-Internal-Job-Key": "expected-key-123456789"},
    )

    assert response.status_code == 200
    assert response.json()["sent"] == 0
