import json
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.database import SessionLocal
from app.jobs.run_engagement_engine import run_engagement_job
from app.models import NotificationDelivery, UserEngagementProfile
from app.services.engagement.learning_store import refresh_learning
from app.services.engagement.motivation import CATEGORY_PRIORS
from app.services.engagement.preferences import NotificationCategory
from tests.auth_helpers import auth_headers


def _producer(client, name: str) -> tuple[dict[str, str], int]:
    headers = auth_headers(client, f"{name}@example.com", name)
    return headers, client.get("/auth/me", headers=headers).json()["id"]


def _push(user_id: int, notification_type: str, *, minutes_ago: int, delivered: int = 1) -> str:
    with SessionLocal() as db:
        delivery = NotificationDelivery(
            user_id=user_id,
            notification_type=notification_type,
            sent_at=datetime.now(timezone.utc) - timedelta(minutes=minutes_ago),
            delivered_count=delivered,
        )
        db.add(delivery)
        db.commit()
        return delivery.id


def _profile(user_id: int) -> UserEngagementProfile:
    with SessionLocal() as db:
        return db.get(UserEngagementProfile, user_id)


def test_an_ignored_push_raises_fatigue_once_it_settles(client):
    _, user_id = _producer(client, "learn-ignored")
    _push(user_id, "rank_close", minutes_ago=150)

    with SessionLocal() as db:
        run_engagement_job(db, settings)

    profile = _profile(user_id)
    assert profile.ignored_streak == 1
    assert profile.fatigue_score > 0
    assert json.loads(profile.motivation_scores_json)["rank"] < CATEGORY_PRIORS[NotificationCategory.RANK]


def test_a_session_after_a_push_raises_its_motivation(client):
    headers, user_id = _producer(client, "learn-converted")
    _push(user_id, "social_overtaken", minutes_ago=10)

    client.post("/sessions/start", headers=headers, json={"session_type": "beat_making"})

    social = json.loads(_profile(user_id).motivation_scores_json)["social"]
    assert social > CATEGORY_PRIORS[NotificationCategory.SOCIAL]


def test_pushes_that_never_reached_a_device_teach_nothing(client):
    _, user_id = _producer(client, "learn-undelivered")
    _push(user_id, "rank_close", minutes_ago=150, delivered=0)

    with SessionLocal() as db:
        run_engagement_job(db, settings)

    profile = _profile(user_id)
    assert profile.ignored_streak == 0
    assert profile.fatigue_score == 0


def test_relearning_from_the_same_history_changes_nothing(client):
    _, user_id = _producer(client, "learn-idempotent")
    _push(user_id, "rank_close", minutes_ago=150)
    with SessionLocal() as db:
        run_engagement_job(db, settings)

    before = _profile(user_id)
    with SessionLocal() as db:
        refresh_learning(db, user_id, datetime.now(timezone.utc))
        db.commit()
    after = _profile(user_id)

    assert (after.fatigue_score, after.ignored_streak, after.motivation_scores_json) == (
        before.fatigue_score,
        before.ignored_streak,
        before.motivation_scores_json,
    )
