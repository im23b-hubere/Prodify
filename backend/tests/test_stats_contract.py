"""Contract checks: stats payloads are internally consistent (no NaN-style assumptions server-side)."""

import math


def _auth(client, email: str, username: str) -> dict[str, str]:
    r = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": "strong-pass-123"},
    )
    assert r.status_code == 201
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_sessions_stats_numeric_sanity_after_session(client):
    headers = _auth(client, "statsnum@example.com", "stats-num-user")
    start = client.post("/sessions/start", headers=headers, json={"session_type": "Beat Making"})
    assert start.status_code == 201
    sid = start.json()["id"]
    stop = client.post("/sessions/stop", headers=headers, json={"session_id": sid})
    assert stop.status_code == 200

    stats = client.get("/sessions/stats?period=week", headers=headers)
    assert stats.status_code == 200
    body = stats.json()
    summary = body["summary"]
    assert summary["total_sessions"] >= 1
    assert summary["total_seconds"] >= 0
    assert not math.isnan(float(summary["total_seconds"]))
    assert summary["avg_session_seconds"] >= 0
    assert isinstance(body["trend"], list)
    for row in body["trend"]:
        assert "label" in row
        assert row["sessions"] >= 0
        assert row["seconds"] >= 0
    recent = body["recent_sessions"]
    assert isinstance(recent, list)
    assert len(recent) >= 1
    assert any(r["id"] == sid for r in recent)
    for r in recent:
        assert r["duration_seconds"] is not None


def test_stats_heatmap_days_length(client):
    headers = _auth(client, "heatmap@example.com", "heatmap-user")
    hm = client.get("/stats/heatmap", headers=headers)
    assert hm.status_code == 200
    days = hm.json()["days"]
    assert len(days) == 90
    for d in days:
        assert "date" in d and "seconds" in d and "intensity" in d
        assert d["seconds"] >= 0
        assert 0 <= d["intensity"] <= 4
