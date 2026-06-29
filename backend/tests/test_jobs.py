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


def test_seed_screenshot_account_job_accepts_valid_key(client, monkeypatch):
    monkeypatch.setattr("app.routers.jobs.settings.internal_job_key", "expected-key-123456789")
    monkeypatch.setattr(
        "app.routers.jobs.seed_screenshot_account",
        lambda db, **kwargs: type(
            "Result",
            (),
            {
                "main_email": "eric.huber.ch@gmail.com",
                "main_username": "erix",
                "main_user_id": 1,
                "sessions_created": 120,
                "current_streak": 52,
                "longest_streak": 71,
                "friends_seeded": 6,
                "premium_enabled": True,
            },
        )(),
    )

    response = client.post(
        "/jobs/seed-screenshot-account",
        headers={"X-Internal-Job-Key": "expected-key-123456789"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["main_username"] == "erix"
    assert body["friends_seeded"] == 6
