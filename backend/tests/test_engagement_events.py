from datetime import datetime, timedelta, timezone

from app.config import settings
from app.database import SessionLocal
from app.jobs.run_engagement_engine import run_engagement_job
from app.models import GrowthEvent, NotificationDelivery, ProductionSession, PushToken, User
from app.services.progression_service import grant_xp
from app.services.push_dispatch import dispatch_to_user
from tests.auth_helpers import auth_headers


def _user_id(client, headers) -> int:
    return client.get("/auth/me", headers=headers).json()["id"]


def _event_names(user_id: int) -> list[str]:
    with SessionLocal() as db:
        return [row.event_name for row in db.query(GrowthEvent).filter(GrowthEvent.user_id == user_id)]


def _complete_session(client, headers) -> None:
    started = client.post("/sessions/start", headers=headers, json={"session_type": "beat_making"})
    assert started.status_code == 201
    stopped = client.post("/sessions/stop", headers=headers, json={"session_id": started.json()["id"]})
    assert stopped.status_code == 200


def test_first_session_of_the_day_records_a_streak_extension(client):
    headers = auth_headers(client, "streaker@example.com", "streaker")

    _complete_session(client, headers)

    assert "streak_extended" in _event_names(_user_id(client, headers))


def test_second_session_on_the_same_day_does_not_extend_the_streak_again(client):
    headers = auth_headers(client, "twice@example.com", "twice")

    _complete_session(client, headers)
    _complete_session(client, headers)

    assert _event_names(_user_id(client, headers)).count("streak_extended") == 1


def test_accepting_a_friend_request_records_friend_added_for_both(client):
    alice = auth_headers(client, "alice-ev@example.com", "alice-ev")
    bob = auth_headers(client, "bob-ev@example.com", "bob-ev")
    request = client.post("/friends/request", headers=alice, json={"username": "bob-ev"})

    client.post(f"/friends/{request.json()['id']}/accept", headers=bob)

    assert "friend_added" in _event_names(_user_id(client, alice))
    assert "friend_added" in _event_names(_user_id(client, bob))


def test_crossing_a_level_threshold_records_a_rank_up(client):
    headers = auth_headers(client, "leveler@example.com", "leveler")
    user_id = _user_id(client, headers)

    with SessionLocal() as db:
        grant_xp(db, user_id, 60, source_type="test", source_id="rank-up")
        db.commit()

    assert "rank_up" in _event_names(user_id)


def test_xp_below_the_next_level_does_not_record_a_rank_up(client):
    headers = auth_headers(client, "steady@example.com", "steady")
    user_id = _user_id(client, headers)

    with SessionLocal() as db:
        grant_xp(db, user_id, 10, source_type="test", source_id="no-rank-up")
        db.commit()

    assert "rank_up" not in _event_names(user_id)


def test_engagement_job_settles_expired_deliveries(client, monkeypatch):
    monkeypatch.setattr("app.services.expo_client.send_expo_batch", lambda _t, batch: (len(batch), len(batch), None, []))
    monkeypatch.setattr(settings, "expo_access_token", "test-token")
    headers = auth_headers(client, "job@example.com", "job")
    user_id = _user_id(client, headers)
    with SessionLocal() as db:
        db.add(PushToken(user_id=user_id, token="ExponentPushToken[job]", is_active=1))
        db.commit()
        dispatch_to_user(settings, db, user_id, "Title", "Body", data={"kind": "streak_2h_left"})
        db.commit()

    with SessionLocal() as db:
        result = run_engagement_job(db, settings, now=datetime.now(timezone.utc) + timedelta(hours=3))

    assert result["deliveries_settled"] == 1


def test_deleting_an_account_removes_its_notification_deliveries(client, monkeypatch):
    monkeypatch.setattr("app.services.expo_client.send_expo_batch", lambda _t, batch: (len(batch), len(batch), None, []))
    monkeypatch.setattr(settings, "expo_access_token", "test-token")
    headers = auth_headers(client, "leaver@example.com", "leaver")
    user_id = _user_id(client, headers)
    with SessionLocal() as db:
        db.add(PushToken(user_id=user_id, token="ExponentPushToken[leaver]", is_active=1))
        db.add(ProductionSession(user_id=user_id, started_at=datetime.now(timezone.utc)))
        db.commit()
        dispatch_to_user(settings, db, user_id, "Title", "Body", data={"kind": "streak_2h_left"})
        db.commit()

    assert client.delete("/users/me", headers=headers).status_code == 204

    with SessionLocal() as db:
        assert db.query(NotificationDelivery).count() == 0
        assert db.get(User, user_id) is None
