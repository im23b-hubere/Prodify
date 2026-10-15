from datetime import timedelta

from sqlalchemy import select

from app.database import SessionLocal
from app.models import (
    DeliveryOutcome,
    NotificationDelivery,
    ProductionSession,
    PushToken,
    SocialChallenge,
    SocialChallengeMember,
    Streak,
    User,
    UserNotificationPreferences,
    utcnow,
)
from app.services.engagement.metrics import engagement_metrics
from tests.auth_helpers import auth_headers

NOW = utcnow()


def _producer(client, name: str, *, signed_up_days_ago: int = 0) -> int:
    headers = auth_headers(client, f"{name}@example.com", name)
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    with SessionLocal() as db:
        db.get(User, user_id).created_at = NOW - timedelta(days=signed_up_days_ago)
        db.commit()
    return user_id


def _session(user_id: int, days_ago: float, *, minutes: int | None = 40, deleted: bool = False) -> None:
    started_at = NOW - timedelta(days=days_ago)
    with SessionLocal() as db:
        db.add(
            ProductionSession(
                user_id=user_id,
                started_at=started_at,
                stopped_at=started_at + timedelta(minutes=minutes or 1),
                duration_seconds=minutes * 60 if minutes else None,
                deleted_at=NOW if deleted else None,
            )
        )
        db.commit()


def _push(user_id: int, kind: str, outcome: str, *, opened: bool = False, delivered: bool = True) -> None:
    with SessionLocal() as db:
        db.add(
            NotificationDelivery(
                user_id=user_id,
                notification_type=kind,
                sent_at=NOW - timedelta(days=1),
                delivered_count=1 if delivered else 0,
                opened_at=NOW - timedelta(hours=23) if opened else None,
                outcome=outcome,
            )
        )
        db.commit()


def _metrics():
    with SessionLocal() as db:
        return engagement_metrics(db, NOW, window_days=7)


def test_push_rates_count_only_smart_pushes_that_reached_a_device(client):
    me = _producer(client, "mxpush")
    _push(me, "streak_at_risk", DeliveryOutcome.CONVERTED, opened=True)
    _push(me, "social_overtaken", DeliveryOutcome.CONVERTED, opened=True)
    _push(me, "social_friend_session", DeliveryOutcome.IGNORED)
    _push(me, "rank_close", DeliveryOutcome.PENDING, opened=True)
    _push(me, "session_complete", DeliveryOutcome.IGNORED)
    _push(me, "reengagement", DeliveryOutcome.IGNORED, delivered=False)

    metrics = _metrics()

    assert metrics.smart_notifications_delivered == 4
    assert metrics.primary.notification_conversion_rate == round(2 / 3, 4)
    assert metrics.secondary.notification_open_rate == 0.75
    assert metrics.secondary.social_conversion_rate == 0.5
    assert metrics.negative.notifications_ignored == 1
    assert metrics.negative.notification_ignore_rate == round(1 / 3, 4)


def test_retention_counts_producers_who_came_back_after_n_days(client):
    returned = _producer(client, "mxback", signed_up_days_ago=40)
    _session(returned, days_ago=2)
    gone = _producer(client, "mxgone", signed_up_days_ago=40)
    _session(gone, days_ago=39.5)
    _producer(client, "mxfresh")

    primary = _metrics().primary

    assert primary.retention_d1 == 0.5
    assert primary.retention_d7 == 0.5
    assert primary.retention_d30 == 0.5


def test_session_metrics_cover_the_window_and_deleted_sessions(client):
    me, friend = _producer(client, "mxsessions"), _producer(client, "mxsessfriend")
    _session(me, days_ago=1, minutes=30)
    _session(me, days_ago=2, minutes=50)
    _session(friend, days_ago=3, minutes=40)
    _session(friend, days_ago=4, deleted=True)
    _session(friend, days_ago=20)

    metrics = _metrics()

    assert metrics.primary.weekly_active_producers == 2
    assert metrics.primary.sessions_per_active_user == 1.5
    assert metrics.secondary.avg_session_duration_minutes == 40
    assert metrics.negative.session_abandon_rate == 0.25


def test_opt_outs_show_in_preferences_and_push_tokens(client):
    me = _producer(client, "mxoptout")
    _producer(client, "mxoptin")
    with SessionLocal() as db:
        db.add(UserNotificationPreferences(user_id=me, smart_enabled=False))
        for index, active in enumerate((1, 0, 0, 1)):
            db.add(
                PushToken(
                    user_id=me,
                    token=f"ExponentPushToken[mx-{index}]",
                    platform="ios",
                    channel="expo",
                    is_active=active,
                    created_at=NOW,
                    last_used_at=NOW,
                )
            )
        db.commit()

    negative = _metrics().negative

    assert negative.smart_opt_out_rate == 0.5
    assert negative.push_token_inactive_rate == 0.5


def test_streak_retention_counts_streaks_that_are_still_alive(client):
    alive, broken = _producer(client, "mxalive"), _producer(client, "mxbroken")
    with SessionLocal() as db:
        for user_id, current, last_day in ((alive, 4, NOW - timedelta(hours=20)), (broken, 3, NOW - timedelta(days=5))):
            streak = db.scalar(select(Streak).where(Streak.user_id == user_id)) or Streak(user_id=user_id)
            streak.current_streak, streak.longest_streak, streak.last_session_date = current, 6, last_day
            db.add(streak)
        db.commit()

    assert _metrics().secondary.streak_retention_rate == 0.5


def test_challenge_completion_counts_members_who_hit_the_target(client):
    me, friend = _producer(client, "mxchallenge"), _producer(client, "mxchallfriend")
    with SessionLocal() as db:
        finished = SocialChallenge(owner_id=me, title="Duel", week_start="2026-06-08", target_sessions=3, status="completed")
        running = SocialChallenge(owner_id=me, title="Open", week_start="2026-06-08", target_sessions=3, status="active")
        db.add_all([finished, running])
        db.flush()
        db.add_all(
            [
                SocialChallengeMember(challenge_id=finished.id, user_id=me, progress_sessions=3),
                SocialChallengeMember(challenge_id=finished.id, user_id=friend, progress_sessions=1),
                SocialChallengeMember(challenge_id=running.id, user_id=friend, progress_sessions=3),
            ]
        )
        db.commit()

    assert _metrics().secondary.challenge_completion_rate == 0.5


def test_an_empty_install_reports_zero_rates(client):
    metrics = _metrics()

    assert metrics.smart_notifications_delivered == 0
    assert metrics.primary.notification_conversion_rate == 0
    assert metrics.primary.retention_d30 == 0
    assert metrics.negative.session_abandon_rate == 0
