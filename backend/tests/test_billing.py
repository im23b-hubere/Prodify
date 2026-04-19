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
