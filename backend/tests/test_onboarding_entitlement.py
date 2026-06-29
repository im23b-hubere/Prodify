def _auth_headers(client, email: str, username: str, password: str = "strong-pass-123") -> dict[str, str]:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert register.status_code == 201
    token = register.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_billing_entitlement_has_no_server_trial(client):
    headers = _auth_headers(client, "onboard@example.com", "onboard-user")
    r = client.get("/billing/entitlement", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["entitlement"] == "free"
    assert body["trial_active"] is False
    assert body["expires_at"] is None


def test_outcomes_blocked_without_premium(client):
    headers = _auth_headers(client, "trialout@example.com", "trialout-user")
    r = client.get("/outcomes/goal-forecast/current", headers=headers)
    assert r.status_code == 402
    review = client.get("/outcomes/weekly-review/current", headers=headers)
    assert review.status_code == 402


def test_outcomes_blocked_for_new_free_user(client):
    headers = _auth_headers(client, "notrial@example.com", "notrial-user")
    r = client.get("/outcomes/goal-forecast/current", headers=headers)
    assert r.status_code == 402
    review_current = client.get("/outcomes/weekly-review/current", headers=headers)
    assert review_current.status_code == 402
    review_generate = client.post("/outcomes/weekly-review/generate", headers=headers)
    assert review_generate.status_code == 402
