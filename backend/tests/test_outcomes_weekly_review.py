def _auth_headers(client, email: str, username: str, password: str = "strong-pass-123") -> dict[str, str]:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert register.status_code == 201
    token = register.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_weekly_review_generate_and_fetch(client):
    headers = _auth_headers(client, "review@example.com", "review-user")
    sync = client.post(
        "/billing/sync",
        headers=headers,
        json={"app_user_id": "1", "entitlement": "premium", "trial_active": True, "expires_at": None},
    )
    assert sync.status_code == 200
    generated = client.post("/outcomes/weekly-review/generate", headers=headers)
    assert generated.status_code == 200
    body = generated.json()
    assert "suggestions" in body
    assert len(body["suggestions"]) == 3
    current = client.get("/outcomes/weekly-review/current", headers=headers)
    assert current.status_code == 200
