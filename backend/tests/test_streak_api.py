from tests.test_friends import _register


def test_streak_read_models_and_freeze_precondition(client) -> None:
    token = _register(client, "streak-api@example.com", "streak-api-user")
    headers = {"Authorization": f"Bearer {token}"}

    overview = client.get("/streak/overview", headers=headers)
    history = client.get("/streak/history", headers=headers)
    milestones = client.get("/streak/milestones", headers=headers)
    freeze = client.post("/streak/freeze", headers=headers)

    assert overview.status_code == 200
    body = overview.json()
    assert body["current_streak"] == 0
    assert len(body["last_7_day_states"]) == 7

    weeks = body["calendar_weeks"]
    assert [week["offset"] for week in weeks] == [-3, -2, -1, 0]
    current = weeks[-1]
    assert len(current["days"]) == 7
    assert sum(1 for day in current["days"] if day["is_today"]) == 1
    today_index = next(index for index, day in enumerate(current["days"]) if day["is_today"])
    assert all(not day["is_future"] for day in current["days"][: today_index + 1])
    assert all(day["is_future"] for day in current["days"][today_index + 1 :])
    assert body["last_7_day_states"] == [day["state"] for day in current["days"]]
    assert body["last_7_day_labels"] == [day["label"] for day in current["days"]]
    assert history.status_code == 200
    assert history.json() == []
    assert milestones.status_code == 200
    assert milestones.json()["longest_streak_days"] == 0
    assert freeze.status_code == 400
    assert freeze.json()["error"]["message"] == "Start a streak before using a freeze."
