from datetime import datetime, timedelta, timezone

from app.config import settings
from app.database import SessionLocal
from app.models import NotificationDelivery, ProductionSession
from tests.auth_helpers import auth_headers


def _producer(client, name: str) -> tuple[dict[str, str], int]:
    headers = auth_headers(client, f"{name}@example.com", name)
    return headers, client.get("/auth/me", headers=headers).json()["id"]


def _add_session(user_id: int, started_at: datetime) -> None:
    with SessionLocal() as db:
        db.add(
            ProductionSession(
                user_id=user_id,
                started_at=started_at,
                stopped_at=started_at + timedelta(minutes=45),
                duration_seconds=45 * 60,
            )
        )
        db.commit()


def _push(user_id: int, notification_type: str) -> None:
    with SessionLocal() as db:
        db.add(
            NotificationDelivery(
                user_id=user_id,
                notification_type=notification_type,
                sent_at=datetime.now(timezone.utc) - timedelta(hours=1),
                candidate_score=61,
                reason="test reason",
            )
        )
        db.commit()


def test_the_debug_view_explains_the_current_decision(client):
    headers, user_id = _producer(client, "debug-me")
    _add_session(user_id, datetime.now(timezone.utc) - timedelta(days=4))

    response = client.get("/engagement/debug", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["profile"]["total_sessions"] == 1
    assert body["production_window"]["is_default"] is True
    assert body["segment"] == "new_user"
    assert 0 < body["return_probability_24h"] < 1
    assert set(body["decision"]) == {"should_send", "chosen_type", "score", "reason", "scheduled_at"}
    for candidate in body["candidates"]:
        assert candidate["total"] == sum(candidate["parts"].values())


def test_the_debug_view_is_a_dry_run(client):
    headers, user_id = _producer(client, "debug-dry")
    _add_session(user_id, datetime.now(timezone.utc) - timedelta(days=4))

    client.get("/engagement/debug", headers=headers)

    with SessionLocal() as db:
        assert db.query(NotificationDelivery).filter_by(user_id=user_id).count() == 0


def test_the_debug_view_shows_only_the_signed_in_producer(client):
    headers, _ = _producer(client, "debug-viewer")
    _, other_id = _producer(client, "debug-other")
    _push(other_id, "social_overtaken")

    body = client.get(f"/engagement/debug?user_id={other_id}", headers=headers).json()

    assert body["last_delivery"] is None


def test_the_debug_view_shows_the_last_smart_push(client):
    headers, user_id = _producer(client, "debug-last")
    _push(user_id, "rank_close")

    last = client.get("/engagement/debug", headers=headers).json()["last_delivery"]

    assert (last["notification_type"], last["candidate_score"], last["reason"]) == ("rank_close", 61, "test reason")


def test_the_debug_view_does_not_exist_in_production(client, monkeypatch):
    headers, _ = _producer(client, "debug-prod")
    monkeypatch.setattr(settings, "environment", "production")

    assert client.get("/engagement/debug", headers=headers).status_code == 404


def test_the_debug_view_needs_a_signed_in_producer(client):
    assert client.get("/engagement/debug").status_code == 401
