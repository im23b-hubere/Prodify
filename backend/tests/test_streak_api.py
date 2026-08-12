from tests.test_friends import _register


def test_streak_read_models_and_freeze_precondition(client) -> None:
    token = _register(client, "streak-api@example.com", "streak-api-user")
    headers = {"Authorization": f"Bearer {token}"}

    overview = client.get("/streak/overview", headers=headers)
    history = client.get("/streak/history", headers=headers)
    milestones = client.get("/streak/milestones", headers=headers)
    freeze = client.post("/streak/freeze", headers=headers)

    assert overview.status_code == 200
    assert overview.json()["current_streak"] == 0
    assert len(overview.json()["last_7_day_states"]) == 7
    assert history.status_code == 200
    assert history.json() == []
    assert milestones.status_code == 200
    assert milestones.json()["longest_streak_days"] == 0
    assert freeze.status_code == 400
    assert freeze.json()["error"]["message"] == "Start a streak before using a freeze."
