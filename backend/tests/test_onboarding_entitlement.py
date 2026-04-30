def _auth_headers(client, email: str, username: str, password: str = "strong-pass-123") -> dict[str, str]:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert register.status_code == 201
    token = register.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_billing_entitlement_reflects_onboarding_trial(client):
    headers = _auth_headers(client, "onboard@example.com", "onboard-user")
    r = client.get("/billing/entitlement", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["entitlement"] == "free"
    assert body["trial_active"] is True
    assert body["expires_at"] is not None


def test_outcomes_accessible_during_onboarding_without_billing_row(client):
    headers = _auth_headers(client, "trialout@example.com", "trialout-user")
    r = client.get("/outcomes/goal-forecast/current", headers=headers)
    assert r.status_code == 200


def test_outcomes_blocked_when_onboarding_days_zero(client, monkeypatch):
    monkeypatch.setattr("app.dependencies_subscription.settings.onboarding_trial_days", 0)
    headers = _auth_headers(client, "notrial@example.com", "notrial-user")
    r = client.get("/outcomes/goal-forecast/current", headers=headers)
    assert r.status_code == 402
