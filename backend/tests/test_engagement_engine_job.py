import json
from datetime import datetime, timedelta, timezone

import pytest

from app.config import settings
from app.database import SessionLocal
from app.jobs.run_engagement_engine import run_engagement_job
from app.jobs.send_streak_reminders import run_streak_reminder_job
from app.services.engagement.engine import evaluate_notification_opportunity
from app.models import (
    Friendship,
    FriendshipStatus,
    LeaderboardSnapshot,
    NotificationDelivery,
    ProductionSession,
    PushToken,
    User,
    UserNotificationPreferences,
)

# 20:00 in Zurich: a producer with yesterday's session has their streak at risk.
EVENING = datetime(2026, 8, 12, 18, 0, tzinfo=timezone.utc)


@pytest.fixture
def engine_on(client, monkeypatch):
    monkeypatch.setattr(settings, "feature_flag_smart_notifications_enabled", True)
    monkeypatch.setattr(settings, "expo_access_token", "")


def _producer(username: str, *, has_token: bool = True) -> int:
    with SessionLocal() as db:
        user = User(email=f"{username}@example.com", username=username, timezone="Europe/Zurich")
        db.add(user)
        db.flush()
        yesterday = EVENING - timedelta(days=1)
        db.add(ProductionSession(user_id=user.id, started_at=yesterday, stopped_at=yesterday, duration_seconds=3600))
        if has_token:
            db.add(PushToken(user_id=user.id, token=f"ExponentPushToken[{username}]", is_active=1))
        db.commit()
        return user.id


def _run(now: datetime = EVENING) -> dict:
    with SessionLocal() as db:
        return run_engagement_job(db, settings, now=now)


def _deliveries(user_id: int) -> list[NotificationDelivery]:
    with SessionLocal() as db:
        return db.query(NotificationDelivery).filter_by(user_id=user_id).all()


def test_the_engine_sends_its_choice_with_the_reason(engine_on):
    user_id = _producer("engine-streak")

    result = _run()

    [delivery] = _deliveries(user_id)
    assert delivery.notification_type == "streak_at_risk"
    assert delivery.candidate_score >= 25
    assert delivery.reason.startswith("streak_at_risk scored")
    assert json.loads(delivery.variables_json)["streakDays"] == "1"
    assert result["engine"]["evaluated"] == 1
    assert result["engine"]["sent"] == 0
    assert result["engine"]["attempted"] == 1
    assert result["engine"]["failed"] == 1


def test_a_failed_attempt_can_be_tried_again(engine_on):
    user_id = _producer("engine-retry")

    _run()
    _run(EVENING + timedelta(minutes=20))

    assert len(_deliveries(user_id)) == 2
    assert all(delivery.delivered_count == 0 for delivery in _deliveries(user_id))


def test_a_delivered_push_blocks_another_one_the_same_evening(engine_on):
    user_id = _producer("engine-once")
    _run()
    with SessionLocal() as db:
        delivery = db.query(NotificationDelivery).filter_by(user_id=user_id).one()
        delivery.delivered_count = 1
        db.commit()

    _run(EVENING + timedelta(minutes=20))

    assert len(_deliveries(user_id)) == 1


def test_producers_without_a_push_token_are_not_evaluated(engine_on):
    user_id = _producer("engine-no-token", has_token=False)

    assert _run()["engine"] == {"evaluated": 0, "sent": 0, "attempted": 0, "failed": 0}
    assert _deliveries(user_id) == []


def test_producers_with_smart_notifications_off_are_not_evaluated(engine_on):
    user_id = _producer("engine-muted")
    with SessionLocal() as db:
        db.add(UserNotificationPreferences(user_id=user_id, smart_enabled=False))
        db.commit()

    assert _run()["engine"] == {"evaluated": 0, "sent": 0, "attempted": 0, "failed": 0}


def test_nothing_changes_with_the_feature_flag_off(client):
    user_id = _producer("engine-flag-off")

    result = _run()

    assert result["engine"] == "disabled"
    assert _deliveries(user_id) == []


def test_each_run_remembers_the_leaderboard_place(engine_on):
    user_id = _producer("engine-ranked")
    friend_id = _producer("engine-friend", has_token=False)
    with SessionLocal() as db:
        db.add(Friendship(user_id=user_id, friend_id=friend_id, status=FriendshipStatus.accepted))
        db.commit()

    _run()

    with SessionLocal() as db:
        snapshot = db.get(LeaderboardSnapshot, (user_id, "2026-08-10"))
        assert snapshot.rank == 1


def test_an_opportunity_can_be_evaluated_without_sending(client):
    user_id = _producer("engine-dry-run")

    with SessionLocal() as db:
        decision = evaluate_notification_opportunity(db, user_id, EVENING)

    assert decision.should_send
    assert decision.type == "streak_at_risk"
    assert _deliveries(user_id) == []


def test_the_streak_job_hands_over_to_the_engine(engine_on, monkeypatch):
    sent: list[int] = []
    monkeypatch.setattr(
        "app.jobs.send_streak_reminders.dispatch_to_user",
        lambda *_args, **_kwargs: sent.append(1) or (1, 1, None),
    )
    _producer("engine-handover")

    with SessionLocal() as db:
        result = run_streak_reminder_job(db, settings, now=datetime(2026, 8, 12, 20, 5, tzinfo=timezone.utc))

    assert sent == []
    assert result == {"reminders_sent": 0, "handled_by": "engagement_engine"}
