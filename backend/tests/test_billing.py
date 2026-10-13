def _auth_headers(client, email: str, username: str, password: str = "strong-pass-123") -> dict[str, str]:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert register.status_code == 201
    token = register.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_billing_entitlement_sync_and_get(client, monkeypatch):
    # Dev sync trusts the client payload only when RevenueCat verification is not configured.
    monkeypatch.setattr("app.routers.billing.settings.revenuecat_secret_key", None)
    headers = _auth_headers(client, "bill@example.com", "bill-user")
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    user_id = str(me.json()["id"])

    r = client.get("/billing/entitlement", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["entitlement"] == "free"
    assert data["trial_active"] is False

    synced = client.post(
        "/billing/sync",
        headers=headers,
        json={
            "app_user_id": user_id,
            "entitlement": "premium",
            "trial_active": False,
            "expires_at": None,
        },
    )
    assert synced.status_code == 200
    assert synced.json()["entitlement"] == "premium"
    assert synced.json()["trial_active"] is False


def test_billing_sync_rejects_mismatched_app_user_id(client):
    headers = _auth_headers(client, "bill-mismatch@example.com", "bill-mismatch-user")
    synced = client.post(
        "/billing/sync",
        headers=headers,
        json={
            "app_user_id": "9999",
            "entitlement": "premium",
            "trial_active": True,
            "expires_at": None,
        },
    )
    assert synced.status_code == 403
    assert "does not match" in synced.json()["error"]["message"]


def test_billing_sync_requires_verification_config_in_production(client, monkeypatch):
    headers = _auth_headers(client, "bill-prod@example.com", "bill-prod-user")
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    user_id = str(me.json()["id"])
    monkeypatch.setattr("app.routers.billing.settings.environment", "production")
    monkeypatch.setattr("app.routers.billing.settings.revenuecat_secret_key", None)

    synced = client.post(
        "/billing/sync",
        headers=headers,
        json={
            "app_user_id": user_id,
            "entitlement": "premium",
            "trial_active": True,
            "expires_at": None,
        },
    )
    assert synced.status_code == 503
    assert "not configured" in synced.json()["error"]["message"].lower()


def test_billing_sync_respects_feature_flag(client, monkeypatch):
    headers = _auth_headers(client, "bill-flag@example.com", "bill-flag-user")
    monkeypatch.setattr("app.routers.billing.settings.feature_flag_billing_sync_enabled", False)
    synced = client.post(
        "/billing/sync",
        headers=headers,
        json={
            "app_user_id": "1",
            "entitlement": "premium",
            "trial_active": True,
            "expires_at": None,
        },
    )
    assert synced.status_code == 503
    assert "temporarily disabled" in synced.json()["error"]["message"].lower()

