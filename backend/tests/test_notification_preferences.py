from datetime import datetime, time
from zoneinfo import ZoneInfo

import pytest

from app.config import settings
from app.database import SessionLocal
from app.jobs.send_streak_reminders import run_streak_reminder_job
from app.models import GrowthEvent, NotificationDelivery, PushToken, User, UserNotificationPreferences
from app.services.engagement.preferences import (
    NotificationCategory,
    category_of,
    default_preferences,
    is_category_allowed,
)
from app.services.push_dispatch import dispatch_to_user
from tests.auth_helpers import auth_headers

DEFAULT_BODY = {
    "smart_enabled": True,
    "streak": True,
    "social": True,
    "challenge": True,
    "rank": True,
    "reengagement": True,
    "quiet_start_minute": 22 * 60 + 30,
    "quiet_end_minute": 8 * 60,
}


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
        db.get(User, user_id).timezone = "Europe/Zurich"
        db.commit()
    return headers, user_id


def _push(user_id: int, kind: str, at: datetime) -> tuple[int, int, str | None]:
    with SessionLocal() as db:
        result = dispatch_to_user(settings, db, user_id, "Title", "Body", data={"kind": kind}, now=at)
        db.commit()
        return result


def _zurich(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 6, 10, hour, minute, tzinfo=ZoneInfo("Europe/Zurich"))


# --- pure rules -------------------------------------------------------------------------------


def test_defaults_allow_every_category_outside_quiet_hours():
    prefs = default_preferences(user_id=1)

    assert all(is_category_allowed(prefs, category, time(18, 0)) for category in NotificationCategory)


@pytest.mark.parametrize("local", [time(22, 30), time(23, 59), time(0, 0), time(7, 59)])
def test_quiet_hours_across_midnight_hold_back_smart_notifications(local):
    prefs = default_preferences(user_id=1)

    assert not is_category_allowed(prefs, NotificationCategory.SOCIAL, local)


@pytest.mark.parametrize("local", [time(8, 0), time(12, 0), time(22, 29)])
def test_quiet_hours_end_at_their_end_minute(local):
    prefs = default_preferences(user_id=1)

    assert is_category_allowed(prefs, NotificationCategory.SOCIAL, local)


def test_streak_reminders_still_reach_the_producer_before_midnight():
    prefs = default_preferences(user_id=1)

    assert is_category_allowed(prefs, NotificationCategory.STREAK, time(23, 25))


def test_equal_quiet_start_and_end_means_no_quiet_window():
    prefs = default_preferences(user_id=1)
    prefs.quiet_start_minute = prefs.quiet_end_minute = 0

    assert is_category_allowed(prefs, NotificationCategory.SOCIAL, time(3, 0))


def test_a_disabled_category_is_never_allowed():
    prefs = default_preferences(user_id=1)
    prefs.social_enabled = False

    assert not is_category_allowed(prefs, NotificationCategory.SOCIAL, time(12, 0))
    assert is_category_allowed(prefs, NotificationCategory.CHALLENGE, time(12, 0))


def test_master_toggle_off_blocks_every_smart_category():
    prefs = default_preferences(user_id=1)
    prefs.smart_enabled = False

    assert not any(is_category_allowed(prefs, category, time(12, 0)) for category in NotificationCategory)


@pytest.mark.parametrize(
    ("kind", "category"),
    [
        ("streak_1h_left", NotificationCategory.STREAK),
        ("friend_nudge", NotificationCategory.SOCIAL),
        ("friend_request", NotificationCategory.SOCIAL),
        ("friend_accepted", NotificationCategory.SOCIAL),
        ("streak_encouragement", NotificationCategory.SOCIAL),
        ("duel_invite", NotificationCategory.CHALLENGE),
        ("challenge_won", NotificationCategory.CHALLENGE),
        ("dashboard", NotificationCategory.REENGAGEMENT),
        ("session_complete", None),
    ],
)
def test_push_kinds_map_to_their_preference_category(kind, category):
    assert category_of(kind) == category


# --- API --------------------------------------------------------------------------------------


def test_preferences_default_until_the_producer_saves_them(client):
    headers, _ = _producer(client, "fresh")

    response = client.get("/users/me/notification-preferences", headers=headers)

    assert response.status_code == 200
    assert response.json() == {**DEFAULT_BODY, "customized": False}


def test_saved_preferences_are_returned_and_marked_customized(client):
    headers, _ = _producer(client, "saver")
    body = {**DEFAULT_BODY, "social": False, "quiet_start_minute": 23 * 60, "quiet_end_minute": 7 * 60}

    put = client.put("/users/me/notification-preferences", headers=headers, json=body)
    get = client.get("/users/me/notification-preferences", headers=headers)

    assert put.status_code == 200
    assert get.json() == {**body, "customized": True}


def test_preferences_belong_to_the_signed_in_producer_only(client):
    alice, _ = _producer(client, "alice")
    bob, _ = _producer(client, "bob")

    client.put("/users/me/notification-preferences", headers=alice, json={**DEFAULT_BODY, "social": False})

    assert client.get("/users/me/notification-preferences", headers=bob).json()["social"] is True


def test_preferences_reject_minutes_outside_the_day(client):
    headers, _ = _producer(client, "outofday")

    response = client.put(
        "/users/me/notification-preferences", headers=headers, json={**DEFAULT_BODY, "quiet_end_minute": 1440}
    )

    assert response.status_code == 422


def test_preferences_require_sign_in(client):
    assert client.get("/users/me/notification-preferences").status_code == 401


# --- every push honours them ------------------------------------------------------------------


def test_a_disabled_category_suppresses_the_push_without_tracking_a_delivery(client, sent_messages):
    headers, user_id = _producer(client, "muted")
    client.put("/users/me/notification-preferences", headers=headers, json={**DEFAULT_BODY, "social": False})

    attempted, delivered, summary = _push(user_id, "friend_nudge", _zurich(12))

    assert (attempted, delivered) == (0, 0)
    assert "preferences" in summary
    assert sent_messages == []
    with SessionLocal() as db:
        assert db.query(NotificationDelivery).count() == 0


def test_quiet_hours_use_the_producers_local_time(client, sent_messages):
    _, user_id = _producer(client, "nightowl")

    _push(user_id, "friend_nudge", _zurich(23, 0))
    _push(user_id, "friend_nudge", _zurich(9, 0))

    assert len(sent_messages) == 1


def test_master_toggle_off_still_delivers_transactional_pushes(client, sent_messages):
    headers, user_id = _producer(client, "quietmode")
    client.put("/users/me/notification-preferences", headers=headers, json={**DEFAULT_BODY, "smart_enabled": False})

    _push(user_id, "duel_invite", _zurich(12))
    _push(user_id, "session_complete", _zurich(23, 30))

    assert [message["data"]["kind"] for message in sent_messages] == ["session_complete"]


def test_streak_job_skips_producers_who_muted_streak_reminders(client, sent_messages):
    headers, user_id = _producer(client, "nostreak")
    client.put("/users/me/notification-preferences", headers=headers, json={**DEFAULT_BODY, "streak": False})

    with SessionLocal() as db:
        result = run_streak_reminder_job(db, settings, now=_zurich(22, 5))

    assert result["reminders_sent"] == 0
    assert result["skipped_muted"] == 1
    assert sent_messages == []


# --- permission signal ------------------------------------------------------------------------


def test_revoked_device_permission_is_recorded_once_per_day(client):
    headers, user_id = _producer(client, "revoked")

    for _ in range(2):
        response = client.post(
            "/engagement/notification-permission", headers=headers, json={"granted": False}
        )
        assert response.status_code == 204

    with SessionLocal() as db:
        events = db.query(GrowthEvent).filter_by(user_id=user_id, event_name="notifications_disabled").count()
    assert events == 1


def test_granted_device_permission_records_nothing(client):
    headers, user_id = _producer(client, "granted")

    client.post("/engagement/notification-permission", headers=headers, json={"granted": True})

    with SessionLocal() as db:
        assert db.query(GrowthEvent).filter_by(user_id=user_id, event_name="notifications_disabled").count() == 0


def test_deleting_a_producer_removes_their_preferences(client):
    headers, user_id = _producer(client, "leaver")
    client.put("/users/me/notification-preferences", headers=headers, json=DEFAULT_BODY)

    assert client.delete("/users/me", headers=headers).status_code == 204

    with SessionLocal() as db:
        assert db.get(UserNotificationPreferences, user_id) is None
