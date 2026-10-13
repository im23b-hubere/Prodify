from tests.auth_helpers import auth_headers
from tests.billing_helpers import (
    in_days,
    rc_subscriber,
    rc_subscriber_without_entitlement,
    store_subscription,
    use_revenuecat,
    user_id_of,
)


def _sync(client, headers: dict[str, str], user_id: int, entitlement: str):
    return client.post(
        "/billing/sync",
        headers=headers,
        json={"app_user_id": str(user_id), "entitlement": entitlement, "trial_active": False},
    )


def _unpaid_user(client, name: str) -> tuple[dict[str, str], int]:
    headers = auth_headers(client, f"{name}@example.com", name, subscriber=False)
    return headers, user_id_of(client, headers)


# --- Expired subscriptions ------------------------------------------------------------------


def test_expired_subscription_reports_free_entitlement(client):
    headers, user_id = _unpaid_user(client, "expired-ent")
    store_subscription(user_id, provider="revenuecat", entitlement="premium", expires_at=in_days(-1))

    entitlement = client.get("/billing/entitlement", headers=headers).json()

    assert entitlement["entitlement"] == "free"


def test_expired_subscription_is_blocked_from_gated_routes(client):
    headers, user_id = _unpaid_user(client, "expired-gate")
    store_subscription(user_id, provider="revenuecat", entitlement="premium", expires_at=in_days(-1))

    response = client.get("/streak/overview", headers=headers)

    assert response.status_code == 402


def test_expired_subscription_is_not_reported_as_premium_on_the_account(client):
    headers, user_id = _unpaid_user(client, "expired-me")
    store_subscription(user_id, provider="revenuecat", entitlement="premium", expires_at=in_days(-1))

    me = client.get("/auth/me", headers=headers).json()

    assert me["is_premium"] is False


def test_active_subscription_is_reported_as_premium_on_the_account(client):
    headers, user_id = _unpaid_user(client, "active-me")
    store_subscription(user_id, provider="revenuecat", entitlement="premium", expires_at=in_days(5))

    me = client.get("/auth/me", headers=headers).json()

    assert me["is_premium"] is True


# --- Sync verifies against RevenueCat -------------------------------------------------------


def test_sync_grants_premium_when_revenuecat_reports_an_active_entitlement(client, monkeypatch):
    headers, user_id = _unpaid_user(client, "sync-rc-premium")
    use_revenuecat(monkeypatch, {str(user_id): rc_subscriber(in_days(7))})

    synced = _sync(client, headers, user_id, "free")

    assert synced.status_code == 200
    assert synced.json()["entitlement"] == "premium"


def test_sync_ignores_entitlements_with_a_different_identifier(client, monkeypatch):
    headers, user_id = _unpaid_user(client, "sync-rc-other-ent")
    use_revenuecat(
        monkeypatch, {str(user_id): rc_subscriber(in_days(7), entitlement_id="premium")}
    )

    synced = _sync(client, headers, user_id, "premium")

    assert synced.json()["entitlement"] == "free"


def test_sync_revokes_an_expired_revenuecat_subscription(client, monkeypatch):
    headers, user_id = _unpaid_user(client, "sync-rc-expired")
    store_subscription(user_id, provider="revenuecat", entitlement="premium", expires_at=in_days(1))
    use_revenuecat(monkeypatch, {str(user_id): rc_subscriber(in_days(-1))})

    synced = _sync(client, headers, user_id, "premium")

    assert synced.json()["entitlement"] == "free"
    assert client.get("/auth/me", headers=headers).json()["is_premium"] is False


# --- Access granted outside RevenueCat ------------------------------------------------------


def test_revenuecat_cannot_revoke_a_manually_granted_account(client, monkeypatch):
    headers = auth_headers(client, "review@example.com", "review-user")
    user_id = user_id_of(client, headers)
    use_revenuecat(monkeypatch, {str(user_id): rc_subscriber_without_entitlement()})

    synced = _sync(client, headers, user_id, "free")

    assert synced.status_code == 200
    assert synced.json()["entitlement"] == "premium"
    assert client.get("/streak/overview", headers=headers).status_code == 200


def test_revenuecat_cannot_revoke_a_seeded_subscription(client, monkeypatch):
    headers, user_id = _unpaid_user(client, "seeded-user")
    store_subscription(user_id, provider="seed", entitlement="premium", expires_at=in_days(300))
    use_revenuecat(monkeypatch, {str(user_id): rc_subscriber_without_entitlement()})

    _sync(client, headers, user_id, "free")

    assert client.get("/billing/entitlement", headers=headers).json()["entitlement"] == "premium"


def test_revenuecat_purchase_replaces_an_expired_seeded_subscription(client, monkeypatch):
    headers, user_id = _unpaid_user(client, "seed-then-buy")
    store_subscription(user_id, provider="seed", entitlement="premium", expires_at=in_days(-1))
    use_revenuecat(monkeypatch, {str(user_id): rc_subscriber(in_days(7))})

    synced = _sync(client, headers, user_id, "premium")

    assert synced.json()["entitlement"] == "premium"
    assert synced.json()["provider"] == "revenuecat"
