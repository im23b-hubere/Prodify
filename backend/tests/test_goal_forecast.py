def _auth_headers(client, email: str, username: str, password: str = "strong-pass-123") -> dict[str, str]:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert register.status_code == 201
    token = register.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_goal_forecast_endpoint(client):
    headers = _auth_headers(client, "forecast@example.com", "forecast-user")
    set_goal = client.post("/goals/set", headers=headers, json={"goal_type": "weekly_sessions", "target_value": 4})
    assert set_goal.status_code == 200

    sync = client.post(
        "/billing/sync",
        headers=headers,
        json={"app_user_id": "1", "entitlement": "premium", "trial_active": False, "expires_at": None},
    )
    assert sync.status_code == 200

    forecast = client.get("/outcomes/goal-forecast/current", headers=headers)
    assert forecast.status_code == 200
    body = forecast.json()
    assert body["target_sessions"] == 4
    assert body["risk_level"] in {"on_track", "at_risk", "off_track"}
