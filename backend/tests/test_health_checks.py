def test_health_live_returns_ok(client):
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_ready_returns_database_ok(client):
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["checks"]["database"] == "ok"


def test_health_ready_returns_503_when_database_unavailable(client, monkeypatch):
    monkeypatch.setattr("app.main.database_is_ready", lambda: False)
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert "not ready" in response.json()["error"]["message"].lower()
