import hashlib
import hmac
import json


def _auth_headers(client, email: str, username: str, password: str = "strong-pass-123") -> dict[str, str]:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert register.status_code == 201
    token = register.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_billing_entitlement_sync_and_get(client):
    headers = _auth_headers(client, "bill@example.com", "bill-user")
    r = client.get("/billing/entitlement", headers=headers)
    assert r.status_code == 200
    assert r.json()["entitlement"] == "free"

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
    assert synced.status_code == 200
    assert synced.json()["entitlement"] == "premium"
    assert synced.json()["trial_active"] is True


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


def test_revenuecat_webhook_rejects_invalid_signature(client):
    payload = {"event": {"app_user_id": "1", "type": "INITIAL_PURCHASE"}}
    response = client.post(
        "/billing/webhooks/revenuecat",
        json=payload,
        headers={"X-Webhook-Signature": "sha256=invalid"},
    )
    assert response.status_code == 403
    assert "invalid webhook signature" in json.dumps(response.json()).lower()


def test_revenuecat_webhook_accepts_valid_signature(client, monkeypatch):
    headers = _auth_headers(client, "bill-webhook@example.com", "bill-webhook-user")
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    user_id = str(me.json()["id"])
    payload = {
        "event": {
            "app_user_id": user_id,
            "type": "INITIAL_PURCHASE",
            "is_active": True,
            "is_trial_period": True,
        }
    }
    raw = json.dumps(payload).encode("utf-8")
    secret = "test-webhook-secret-0123456789"
    signature = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()

    monkeypatch.setattr("app.routers.billing.settings.webhook_secret", secret)

    response = client.post(
        "/billing/webhooks/revenuecat",
        content=raw,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Signature": f"sha256={signature}",
        },
    )
    assert response.status_code == 204
