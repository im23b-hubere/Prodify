from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import ProductionSession
from tests.auth_helpers import auth_headers as _auth_headers
from tests.test_production_sessions import _reflect_production
from tests.test_session_skill_focuses import _finished_session

HOUR = 3600
A_LOT, SOME = 3, 2


def _branch_map(items: list[dict]) -> dict[str, int]:
    return {item["branch"]: item["seconds"] for item in items}


def test_week_stats_use_the_same_branch_math_as_the_skill_tree(client):
    headers = _auth_headers(client, "woran-week@example.com", "woran-week")
    mixing = _finished_session(client, headers, duration_minutes=60, session_type="mixing")
    production = _finished_session(client, headers, duration_minutes=60, session_type="production")
    learning = _finished_session(client, headers, duration_minutes=60, session_type="learning")
    _reflect_production(
        client,
        headers,
        production,
        focus_ids=[],
        area_weights=[("beat_making", A_LOT), ("mixing", SOME)],
    )

    stats = client.get("/sessions/stats?period=week", headers=headers)
    assert stats.status_code == 200
    branches = _branch_map(stats.json()["branch_seconds"])

    assert mixing
    assert learning
    assert branches == {"mixing": HOUR + 1440, "beat_making": 2160}


def test_week_stats_drop_hours_that_fall_outside_the_period(client):
    headers = _auth_headers(client, "woran-old@example.com", "woran-old")
    old = _finished_session(client, headers, duration_minutes=60, session_type="recording")
    fresh = _finished_session(client, headers, duration_minutes=30, session_type="songwriting")
    with SessionLocal() as db:
        db.get(ProductionSession, old).started_at = datetime.now(timezone.utc) - timedelta(days=20)
        db.commit()

    week = client.get("/sessions/stats?period=week", headers=headers).json()
    assert _branch_map(week["branch_seconds"]) == {"songwriting": 1800}

    lifetime = client.get("/sessions/stats?period=all", headers=headers).json()
    assert _branch_map(lifetime["branch_seconds"]) == {
        "recording": 3600,
        "songwriting": 1800,
    }
    assert fresh
