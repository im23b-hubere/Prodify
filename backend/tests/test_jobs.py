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


def test_session_presence_job_accepts_valid_key(client, monkeypatch):
    monkeypatch.setattr("app.routers.jobs.settings.internal_job_key", "expected-key-123456789")
    monkeypatch.setattr(
        "app.routers.jobs.run_session_presence_job",
        lambda db, settings: {"nudged": 0, "stopped": 0, "scanned": 0},
    )

    response = client.post(
        "/jobs/session-presence",
        headers={"X-Internal-Job-Key": "expected-key-123456789"},
    )

    assert response.status_code == 200
    assert response.json()["nudged"] == 0
    assert response.json()["stopped"] == 0


SEED_CREDENTIALS = {
    "main_email": "review-demo@example.com",
    "main_username": "reviewdemo",
    "main_password": "seed-password-1234",
    "friend_password": "seed-password-1234",
}


def _capture_seed_calls(monkeypatch) -> list[dict]:
    calls: list[dict] = []

    def fake_seed(db, **kwargs):
        calls.append(kwargs)
        return type(
            "Result",
            (),
            {
                "main_email": kwargs["main_email"],
                "main_username": kwargs["main_username"],
                "main_user_id": 1,
                "sessions_created": 120,
                "current_streak": 52,
                "longest_streak": 71,
                "friends_seeded": 6,
                "premium_enabled": True,
            },
        )()

    monkeypatch.setattr("app.routers.jobs.seed_screenshot_account", fake_seed)
    return calls


def test_seed_screenshot_account_job_accepts_valid_key(client, monkeypatch):
    monkeypatch.setattr("app.routers.jobs.settings.internal_job_key", "expected-key-123456789")
    calls = _capture_seed_calls(monkeypatch)

    response = client.post(
        "/jobs/seed-screenshot-account",
        headers={"X-Internal-Job-Key": "expected-key-123456789"},
        json=SEED_CREDENTIALS,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["main_username"] == "reviewdemo"
    assert body["friends_seeded"] == 6
    assert calls[0]["main_email"] == "review-demo@example.com"


def test_seed_screenshot_account_job_refuses_a_request_without_credentials(client, monkeypatch):
    """Seeding is destructive, so a bodyless call must never fall back to a default account."""
    monkeypatch.setattr("app.routers.jobs.settings.internal_job_key", "expected-key-123456789")
    calls = _capture_seed_calls(monkeypatch)

    response = client.post(
        "/jobs/seed-screenshot-account",
        headers={"X-Internal-Job-Key": "expected-key-123456789"},
    )

    assert response.status_code == 422
    assert "seed_credentials_required" in json.dumps(response.json())
    assert calls == []


def test_seed_screenshot_account_job_refuses_partial_credentials(client, monkeypatch):
    monkeypatch.setattr("app.routers.jobs.settings.internal_job_key", "expected-key-123456789")
    calls = _capture_seed_calls(monkeypatch)

    response = client.post(
        "/jobs/seed-screenshot-account",
        headers={"X-Internal-Job-Key": "expected-key-123456789"},
        json={"main_email": "review-demo@example.com"},
    )

    assert response.status_code == 422
    assert calls == []


def test_seed_screenshot_account_job_rejects_a_weak_password(client, monkeypatch):
    monkeypatch.setattr("app.routers.jobs.settings.internal_job_key", "expected-key-123456789")
    calls = _capture_seed_calls(monkeypatch)

    response = client.post(
        "/jobs/seed-screenshot-account",
        headers={"X-Internal-Job-Key": "expected-key-123456789"},
        json={**SEED_CREDENTIALS, "main_password": "short11"},
    )

    assert response.status_code == 422
    assert calls == []


def test_seed_screenshot_account_job_rejects_invalid_key(client, monkeypatch):
    monkeypatch.setattr("app.routers.jobs.settings.internal_job_key", "expected-key-123456789")
    calls = _capture_seed_calls(monkeypatch)

    response = client.post(
        "/jobs/seed-screenshot-account",
        headers={"X-Internal-Job-Key": "wrong-key"},
        json=SEED_CREDENTIALS,
    )

    assert response.status_code == 401
    assert calls == []


REVIEW_JOB_KEY = "expected-key-123456789"
REVIEW_ACCOUNT = {
    "email": "app-review@example.org",
    "username": "prodifyreview",
    "password": "review-password-123",
}


def _seed_review_account(client, monkeypatch, body: dict, key: str = REVIEW_JOB_KEY):
    monkeypatch.setattr("app.routers.jobs.settings.internal_job_key", REVIEW_JOB_KEY)
    return client.post("/jobs/seed-review-account", headers={"X-Internal-Job-Key": key}, json=body)


def test_seed_review_account_job_names_the_profiles_for_the_review_notes(client, monkeypatch):
    response = _seed_review_account(client, monkeypatch, REVIEW_ACCOUNT)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["reviewer_username"] == "prodifyreview"
    assert body["requester_username"]
    assert body["open_profile_username"]
    assert "password" not in json.dumps(body)


def test_seed_review_account_job_rejects_invalid_key(client, monkeypatch):
    response = _seed_review_account(client, monkeypatch, REVIEW_ACCOUNT, key="wrong-key")

    assert response.status_code == 401


def test_seed_review_account_job_rejects_a_level_beyond_the_rank_path(client, monkeypatch):
    response = _seed_review_account(client, monkeypatch, {**REVIEW_ACCOUNT, "level": 21})

    assert response.status_code == 422


def test_seed_review_account_job_reports_a_collision_with_a_real_account(client, monkeypatch):
    client.post(
        "/auth/register",
        json={"email": "real@example.org", "username": "prodifyreview", "password": "strong-pass-123"},
    )

    response = _seed_review_account(client, monkeypatch, REVIEW_ACCOUNT)

    assert response.status_code == 409
    assert "review_seed_collision" in json.dumps(response.json())
