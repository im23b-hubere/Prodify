from tests.auth_helpers import auth_headers

_UNPAID_PRODUCT_CALLS = (
    ("POST", "/sessions/start", {"session_type": "beat_making"}),
    ("GET", "/streak/overview", None),
    ("GET", "/goals/current", None),
    ("GET", "/friends/incoming", None),
    ("GET", "/stats/insights", None),
    ("GET", "/progression/levels", None),
    ("GET", "/notifications/inbox", None),
    ("PUT", "/users/me/timezone", {"timezone": "Europe/Berlin"}),
    ("GET", "/outcomes/output-metrics/current", None),
    ("GET", "/social/commitments", None),
)


def test_unpaid_account_is_blocked_from_the_product(client):
    headers = auth_headers(client, "paywall@example.com", "paywall-user", subscriber=False)
    for method, path, body in _UNPAID_PRODUCT_CALLS:
        response = client.request(method, path, headers=headers, json=body)
        assert response.status_code == 402, f"{method} {path} -> {response.status_code} {response.text}"


def test_unpaid_account_can_still_subscribe_or_leave(client):
    headers = auth_headers(client, "leave@example.com", "leave-user", subscriber=False)
    me = client.get("/auth/me", headers=headers)
    entitlement = client.get("/billing/entitlement", headers=headers)
    legal = client.get("/legal/documents")
    flags = client.get("/feature-flags")
    deleted = client.delete("/users/me", headers=headers)

    assert me.status_code == 200
    assert me.json()["is_premium"] is False
    assert entitlement.status_code == 200
    assert entitlement.json()["entitlement"] == "free"
    assert legal.status_code == 200
    assert flags.status_code == 200
    assert deleted.status_code == 204


def test_subscriber_can_start_a_session(client):
    headers = auth_headers(client, "paid@example.com", "paid-user")
    started = client.post("/sessions/start", headers=headers, json={"session_type": "beat_making"})
    assert started.status_code == 201
