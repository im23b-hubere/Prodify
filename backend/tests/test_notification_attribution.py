from datetime import datetime, timedelta, timezone

import pytest

from app.config import settings
from app.database import SessionLocal
from app.models import GrowthEvent, NotificationDelivery, PushToken
from app.services.engagement.deliveries import (
    attribute_session_start,
    settle_expired_deliveries,
)
from app.services.push_dispatch import dispatch_to_user
from tests.auth_helpers import auth_headers


@pytest.fixture
def sent_messages(monkeypatch):
    messages: list[dict] = []

    def fake_expo_send(_access_token, batch):
        messages.extend(batch)
        return len(batch), len(batch), None, []

    monkeypatch.setattr("app.services.expo_client.send_expo_batch", fake_expo_send)
    monkeypatch.setattr(settings, "expo_access_token", "test-token")
    return messages


def _producer(client, name: str) -> tuple[dict[str, str], int]:
    headers = auth_headers(client, f"{name}@example.com", name)
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    with SessionLocal() as db:
        db.add(PushToken(user_id=user_id, token=f"ExponentPushToken[{name}]", is_active=1))
        db.commit()
    return headers, user_id


def _push(user_id: int, kind: str = "streak_2h_left") -> str:
    with SessionLocal() as db:
        dispatch_to_user(settings, db, user_id, "Title", "Body", data={"kind": kind})
        db.commit()
        return db.query(NotificationDelivery).order_by(NotificationDelivery.sent_at.desc()).first().id


def _backdate(delivery_id: str, minutes: int) -> None:
    with SessionLocal() as db:
        delivery = db.get(NotificationDelivery, delivery_id)
        delivery.sent_at = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        db.commit()


def _start_session(client, headers) -> int:
    response = client.post("/sessions/start", headers=headers, json={"session_type": "beat_making"})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _delivery(delivery_id: str) -> NotificationDelivery:
    with SessionLocal() as db:
        delivery = db.get(NotificationDelivery, delivery_id)
        db.expunge(delivery)
        return delivery


def test_every_push_carries_the_id_of_its_tracked_delivery(client, sent_messages):
    _, user_id = _producer(client, "tracked")

    delivery_id = _push(user_id, kind="streak_2h_left")

    delivery = _delivery(delivery_id)
    assert sent_messages[0]["data"]["nid"] == delivery_id
    assert delivery.notification_type == "streak_2h_left"
    assert delivery.delivered_count == 1
    assert delivery.outcome == "pending"


def test_no_delivery_is_recorded_when_the_user_has_no_push_token(client, sent_messages):
    headers = auth_headers(client, "tokenless@example.com", "tokenless")
    user_id = client.get("/auth/me", headers=headers).json()["id"]

    with SessionLocal() as db:
        dispatch_to_user(settings, db, user_id, "Title", "Body", data={"kind": "streak_2h_left"})
        db.commit()
        assert db.query(NotificationDelivery).count() == 0


def test_opening_a_notification_records_the_open_once(client, sent_messages):
    headers, user_id = _producer(client, "opener")
    delivery_id = _push(user_id)

    first = client.post(f"/notifications/{delivery_id}/opened", headers=headers)
    opened_at = _delivery(delivery_id).opened_at
    second = client.post(f"/notifications/{delivery_id}/opened", headers=headers)

    assert first.status_code == 204
    assert second.status_code == 204
    assert opened_at is not None
    assert _delivery(delivery_id).opened_at == opened_at


def test_a_producer_cannot_open_someone_elses_notification(client, sent_messages):
    _, owner_id = _producer(client, "owner")
    intruder_headers, _ = _producer(client, "intruder")
    delivery_id = _push(owner_id)

    response = client.post(f"/notifications/{delivery_id}/opened", headers=intruder_headers)

    assert response.status_code == 404
    assert _delivery(delivery_id).opened_at is None


def test_session_started_within_two_hours_converts_the_notification(client, sent_messages):
    headers, user_id = _producer(client, "converter")
    delivery_id = _push(user_id)
    _backdate(delivery_id, minutes=4)

    session_id = _start_session(client, headers)

    delivery = _delivery(delivery_id)
    assert delivery.outcome == "converted"
    assert delivery.session_id == session_id
    assert delivery.minutes_until_session == 4


def test_session_started_after_the_window_is_not_attributed(client, sent_messages):
    headers, user_id = _producer(client, "late")
    delivery_id = _push(user_id)
    _backdate(delivery_id, minutes=121)

    _start_session(client, headers)

    assert _delivery(delivery_id).session_id is None


def test_only_the_latest_notification_gets_credit_for_a_session(client, sent_messages):
    headers, user_id = _producer(client, "double")
    older_id = _push(user_id)
    _backdate(older_id, minutes=90)
    newer_id = _push(user_id)
    _backdate(newer_id, minutes=10)

    _start_session(client, headers)

    assert _delivery(newer_id).outcome == "converted"
    assert _delivery(older_id).session_id is None


def test_transactional_pushes_never_take_credit_for_a_session(client, sent_messages):
    headers, user_id = _producer(client, "transactional")
    delivery_id = _push(user_id, kind="session_complete")

    _start_session(client, headers)

    assert _delivery(delivery_id).session_id is None


def test_attribution_records_a_session_started_after_notification_event(client, sent_messages):
    headers, user_id = _producer(client, "evented")
    _push(user_id)

    _start_session(client, headers)

    with SessionLocal() as db:
        names = [row.event_name for row in db.query(GrowthEvent).filter(GrowthEvent.user_id == user_id)]
    assert "session_started_after_notification" in names


def test_expired_deliveries_settle_as_ignored_or_opened_only(client, sent_messages):
    headers, user_id = _producer(client, "settler")
    ignored_id = _push(user_id)
    opened_id = _push(user_id)
    client.post(f"/notifications/{opened_id}/opened", headers=headers)
    fresh_id = _push(user_id)
    _backdate(ignored_id, minutes=130)
    _backdate(opened_id, minutes=125)

    with SessionLocal() as db:
        settled = settle_expired_deliveries(db, datetime.now(timezone.utc))
        db.commit()

    assert settled == 2
    assert _delivery(ignored_id).outcome == "ignored"
    assert _delivery(opened_id).outcome == "opened_only"
    assert _delivery(fresh_id).outcome == "pending"


def test_app_open_after_a_notification_is_recorded_on_it(client, sent_messages):
    headers, user_id = _producer(client, "app-opener")
    delivery_id = _push(user_id)

    response = client.post("/engagement/app-open", headers=headers)

    assert response.status_code == 204
    assert _delivery(delivery_id).app_opened_at is not None


def test_app_opens_are_counted_at_most_once_per_half_hour(client, sent_messages):
    headers, user_id = _producer(client, "frequent")

    client.post("/engagement/app-open", headers=headers)
    client.post("/engagement/app-open", headers=headers)

    with SessionLocal() as db:
        opens = (
            db.query(GrowthEvent)
            .filter(GrowthEvent.user_id == user_id, GrowthEvent.event_name == "app_opened")
            .count()
        )
    assert opens == 1


def test_attribution_ignores_notifications_sent_after_the_session_started(client, sent_messages):
    _, user_id = _producer(client, "future")
    delivery_id = _push(user_id)

    with SessionLocal() as db:
        before_the_push = datetime.now(timezone.utc) - timedelta(minutes=5)
        attributed = attribute_session_start(db, user_id, session_id=1, started_at=before_the_push)
        db.commit()

    assert attributed is None
    assert _delivery(delivery_id).session_id is None
