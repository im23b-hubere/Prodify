import time

from tests.auth_helpers import auth_headers
from tests.billing_helpers import (
    WEBHOOK_AUTH,
    in_days,
    post_webhook,
    rc_subscriber,
    revenuecat_signature,
    store_subscription,
    use_revenuecat,
    use_webhook_auth,
    user_id_of,
    webhook_body,
)


def _unpaid_user(client, name: str) -> tuple[dict[str, str], int]:
    headers = auth_headers(client, f"{name}@example.com", name, subscriber=False)
    return headers, user_id_of(client, headers)


def _entitlement(client, headers: dict[str, str]) -> str:
    return client.get("/billing/entitlement", headers=headers).json()["entitlement"]


# --- Authentication -------------------------------------------------------------------------


def test_webhook_with_configured_authorization_header_is_accepted(client, monkeypatch):
    use_webhook_auth(monkeypatch)
    _, user_id = _unpaid_user(client, "wh-auth")
    use_revenuecat(monkeypatch, {str(user_id): rc_subscriber(in_days(7))})

    response = post_webhook(client, {"type": "INITIAL_PURCHASE", "app_user_id": str(user_id)})

    assert response.status_code == 204


def test_webhook_with_wrong_authorization_header_is_rejected(client, monkeypatch):
    use_webhook_auth(monkeypatch)

    response = post_webhook(
        client,
        {"type": "INITIAL_PURCHASE", "app_user_id": "1"},
        headers={"Authorization": "Bearer wrong"},
    )

    assert response.status_code == 403


def test_webhook_without_any_credentials_is_rejected(client, monkeypatch):
    use_webhook_auth(monkeypatch)

    response = post_webhook(client, {"type": "INITIAL_PURCHASE", "app_user_id": "1"}, headers={})

    assert response.status_code == 403


def test_webhook_is_rejected_when_no_webhook_credentials_are_configured(client, monkeypatch):
    monkeypatch.setattr("app.config.settings.revenuecat_webhook_auth", None)
    monkeypatch.setattr("app.config.settings.revenuecat_webhook_signing_secret", None)

    response = post_webhook(client, {"type": "INITIAL_PURCHASE", "app_user_id": "1"})

    assert response.status_code == 403


def test_webhook_with_valid_revenuecat_hmac_signature_is_accepted(client, monkeypatch):
    use_webhook_auth(monkeypatch)
    _, user_id = _unpaid_user(client, "wh-hmac")
    use_revenuecat(monkeypatch, {str(user_id): rc_subscriber(in_days(7))})
    event = {"type": "INITIAL_PURCHASE", "app_user_id": str(user_id)}

    response = post_webhook(
        client,
        event,
        headers={"X-RevenueCat-Webhook-Signature": revenuecat_signature(webhook_body(event))},
    )

    assert response.status_code == 204


def test_webhook_with_hmac_signature_over_different_body_is_rejected(client, monkeypatch):
    use_webhook_auth(monkeypatch)
    event = {"type": "INITIAL_PURCHASE", "app_user_id": "1"}
    signature_for_other_body = revenuecat_signature(webhook_body({"type": "TEST"}))

    response = post_webhook(
        client, event, headers={"X-RevenueCat-Webhook-Signature": signature_for_other_body}
    )

    assert response.status_code == 403


def test_webhook_with_stale_hmac_timestamp_is_rejected(client, monkeypatch):
    use_webhook_auth(monkeypatch)
    event = {"type": "INITIAL_PURCHASE", "app_user_id": "1"}
    ten_minutes_ago = int(time.time()) - 600

    response = post_webhook(
        client,
        event,
        headers={
            "X-RevenueCat-Webhook-Signature": revenuecat_signature(
                webhook_body(event), timestamp=ten_minutes_ago
            )
        },
    )

    assert response.status_code == 403


# --- Subscription state follows RevenueCat --------------------------------------------------


def test_purchase_webhook_grants_premium_from_revenuecat_state(client, monkeypatch):
    use_webhook_auth(monkeypatch)
    headers, user_id = _unpaid_user(client, "wh-purchase")
    use_revenuecat(monkeypatch, {str(user_id): rc_subscriber(in_days(7))})

    post_webhook(client, {"type": "INITIAL_PURCHASE", "app_user_id": str(user_id)})

    assert _entitlement(client, headers) == "premium"
    assert client.get("/auth/me", headers=headers).json()["is_premium"] is True


def test_cancellation_keeps_access_until_the_paid_period_ends(client, monkeypatch):
    use_webhook_auth(monkeypatch)
    headers, user_id = _unpaid_user(client, "wh-cancel")
    use_revenuecat(monkeypatch, {str(user_id): rc_subscriber(in_days(3))})

    post_webhook(client, {"type": "CANCELLATION", "app_user_id": str(user_id)})

    assert _entitlement(client, headers) == "premium"


def test_expiration_webhook_revokes_access(client, monkeypatch):
    use_webhook_auth(monkeypatch)
    headers, user_id = _unpaid_user(client, "wh-expire")
    store_subscription(user_id, provider="revenuecat", entitlement="premium", expires_at=in_days(1))
    use_revenuecat(monkeypatch, {str(user_id): rc_subscriber(in_days(-1))})

    post_webhook(client, {"type": "EXPIRATION", "app_user_id": str(user_id)})

    assert _entitlement(client, headers) == "free"


def test_billing_issue_during_grace_period_keeps_access(client, monkeypatch):
    use_webhook_auth(monkeypatch)
    headers, user_id = _unpaid_user(client, "wh-grace")
    use_revenuecat(
        monkeypatch,
        {str(user_id): rc_subscriber(in_days(-1), grace_period_expires_at=in_days(5))},
    )

    post_webhook(client, {"type": "BILLING_ISSUE", "app_user_id": str(user_id)})

    assert _entitlement(client, headers) == "premium"


def test_uncancellation_webhook_restores_premium(client, monkeypatch):
    use_webhook_auth(monkeypatch)
    headers, user_id = _unpaid_user(client, "wh-uncancel")
    use_revenuecat(monkeypatch, {str(user_id): rc_subscriber(in_days(6))})

    post_webhook(client, {"type": "UNCANCELLATION", "app_user_id": str(user_id)})

    assert _entitlement(client, headers) == "premium"


def test_purchase_made_while_anonymous_is_attributed_through_aliases(client, monkeypatch):
    use_webhook_auth(monkeypatch)
    headers, user_id = _unpaid_user(client, "wh-alias")
    requested = use_revenuecat(monkeypatch, {str(user_id): rc_subscriber(in_days(7))})

    response = post_webhook(
        client,
        {
            "type": "INITIAL_PURCHASE",
            "app_user_id": "$RCAnonymousID:8c1f0b5e",
            "original_app_user_id": "$RCAnonymousID:8c1f0b5e",
            "aliases": ["$RCAnonymousID:8c1f0b5e", str(user_id)],
        },
    )

    assert response.status_code == 204
    assert requested == [str(user_id)]
    assert _entitlement(client, headers) == "premium"


def test_transfer_moves_access_between_accounts(client, monkeypatch):
    use_webhook_auth(monkeypatch)
    old_headers, old_id = _unpaid_user(client, "wh-transfer-from")
    new_headers, new_id = _unpaid_user(client, "wh-transfer-to")
    store_subscription(old_id, provider="revenuecat", entitlement="premium", expires_at=in_days(5))
    use_revenuecat(monkeypatch, {str(new_id): rc_subscriber(in_days(5))})

    post_webhook(
        client,
        {
            "type": "TRANSFER",
            "transferred_from": [str(old_id)],
            "transferred_to": [str(new_id)],
        },
    )

    assert _entitlement(client, old_headers) == "free"
    assert _entitlement(client, new_headers) == "premium"


def test_webhook_for_unknown_customer_is_acknowledged_without_changes(client, monkeypatch):
    use_webhook_auth(monkeypatch)
    requested = use_revenuecat(monkeypatch, {})

    response = post_webhook(client, {"type": "TEST", "app_user_id": "$RCAnonymousID:dashboard"})

    assert response.status_code == 204
    assert requested == []


def test_webhook_is_retryable_when_revenuecat_verification_is_not_configured(client, monkeypatch):
    use_webhook_auth(monkeypatch)
    _, user_id = _unpaid_user(client, "wh-no-secret")
    monkeypatch.setattr("app.config.settings.revenuecat_secret_key", "")

    response = post_webhook(client, {"type": "INITIAL_PURCHASE", "app_user_id": str(user_id)})

    assert response.status_code == 503


def test_webhook_is_retryable_when_revenuecat_is_unreachable(client, monkeypatch):
    use_webhook_auth(monkeypatch)
    _, user_id = _unpaid_user(client, "wh-rc-down")
    use_revenuecat(monkeypatch, {})

    def unreachable(_app_user_id: str) -> dict:
        raise ConnectionError("RevenueCat is down")

    monkeypatch.setattr(
        "app.services.subscription_service.fetch_revenuecat_subscriber", unreachable
    )

    response = post_webhook(client, {"type": "RENEWAL", "app_user_id": str(user_id)})

    assert response.status_code == 502


def test_authorization_header_value_is_compared_exactly(client, monkeypatch):
    use_webhook_auth(monkeypatch)

    response = post_webhook(
        client,
        {"type": "TEST", "app_user_id": "1"},
        headers={"Authorization": WEBHOOK_AUTH + "x"},
    )

    assert response.status_code == 403
