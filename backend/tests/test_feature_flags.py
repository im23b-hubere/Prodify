def test_feature_flags_endpoint_returns_current_flag_snapshot(client):
    response = client.get("/feature-flags")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {
        "billing_sync_enabled",
        "push_notifications_enabled",
        "smart_nudges_enabled",
    }
