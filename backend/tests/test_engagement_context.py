import json
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.database import SessionLocal
from app.models import (
    Friendship,
    FriendshipStatus,
    NotificationDelivery,
    ProductionSession,
    SocialChallenge,
    SocialChallengeMember,
    UserBlock,
    UserEngagementProfile,
)
from app.services.engagement.context import (
    LeaderboardStanding,
    load_engagement_context,
    record_leaderboard_snapshot,
    record_return_outlook,
)
from app.services.streak_calendar import StreakCalendar
from tests.auth_helpers import auth_headers

NOW = datetime(2026, 6, 10, 19, 0, tzinfo=timezone.utc)  # Wednesday; the local week began 2026-06-08
UTC = StreakCalendar(ZoneInfo("UTC"))


def _producer(client, name: str) -> int:
    headers = auth_headers(client, f"{name}@example.com", name)
    return client.get("/auth/me", headers=headers).json()["id"]


def _befriend(user_id: int, friend_id: int) -> None:
    with SessionLocal() as db:
        db.add(Friendship(user_id=user_id, friend_id=friend_id, status=FriendshipStatus.accepted))
        db.commit()


def _add_session(user_id: int, stopped_at: datetime, minutes: int = 40) -> None:
    with SessionLocal() as db:
        db.add(
            ProductionSession(
                user_id=user_id,
                started_at=stopped_at - timedelta(minutes=minutes),
                stopped_at=stopped_at,
                duration_seconds=minutes * 60,
            )
        )
        db.commit()


def _load(user_id: int):
    with SessionLocal() as db:
        return load_engagement_context(db, user_id, NOW)


# --- friend sessions --------------------------------------------------------------------------


def test_a_friends_session_that_just_ended_is_in_the_context(client):
    me, friend = _producer(client, "ctxme"), _producer(client, "ctxmira")
    _befriend(me, friend)
    _add_session(friend, NOW - timedelta(minutes=10), minutes=45)

    sessions = _load(me).friend_sessions

    assert [(s.friend_name, s.duration_minutes) for s in sessions] == [("ctxmira", 45)]


def test_older_friend_sessions_are_left_out(client):
    me, friend = _producer(client, "ctxold"), _producer(client, "ctxoldfriend")
    _befriend(me, friend)
    _add_session(friend, NOW - timedelta(hours=3))

    assert _load(me).friend_sessions == ()


def test_sessions_of_non_friends_are_left_out(client):
    me, stranger = _producer(client, "ctxalone"), _producer(client, "ctxstranger")
    _add_session(stranger, NOW - timedelta(minutes=10))

    assert _load(me).friend_sessions == ()
    assert _load(me).leaderboard is None


def test_sessions_of_blocked_friends_are_left_out(client):
    me, friend = _producer(client, "ctxblocker"), _producer(client, "ctxblocked")
    _befriend(me, friend)
    _add_session(friend, NOW - timedelta(minutes=10))
    with SessionLocal() as db:
        db.add(UserBlock(blocker_id=friend, blocked_id=me))
        db.commit()

    assert _load(me).friend_sessions == ()


# --- challenges -------------------------------------------------------------------------------


def _challenge(owner_id: int, *, status: str = "active", progress: int = 3) -> int:
    with SessionLocal() as db:
        challenge = SocialChallenge(
            owner_id=owner_id,
            title="June duel",
            week_start="2026-06-08",
            target_sessions=5,
            status=status,
            meta_json=json.dumps({"started_at": "2026-06-08T00:00:00+00:00", "duration_days": 7}),
        )
        db.add(challenge)
        db.flush()
        db.add(SocialChallengeMember(challenge_id=challenge.id, user_id=owner_id, progress_sessions=progress))
        db.commit()
        return challenge.id


def test_an_active_challenge_shows_what_is_left(client):
    me = _producer(client, "ctxchallenger")
    challenge_id = _challenge(me)

    [standing] = _load(me).challenges

    assert standing.challenge_id == challenge_id
    assert standing.sessions_remaining == 2
    assert standing.ends_at == datetime(2026, 6, 15, tzinfo=timezone.utc)


def test_finished_challenges_are_left_out(client):
    me = _producer(client, "ctxfinished")
    _challenge(me, status="completed")

    assert _load(me).challenges == ()


# --- leaderboard ------------------------------------------------------------------------------


def test_the_context_knows_the_place_before_a_friend_moved_ahead(client):
    me, friend = _producer(client, "ctxrank"), _producer(client, "ctxrival")
    _befriend(me, friend)
    _add_session(me, NOW - timedelta(days=1))
    with SessionLocal() as db:
        standing = load_engagement_context(db, me, NOW).leaderboard
        record_leaderboard_snapshot(db, me, standing, UTC, NOW)
        db.commit()
    _add_session(friend, NOW - timedelta(hours=5))
    _add_session(friend, NOW - timedelta(hours=3))

    standing = _load(me).leaderboard

    assert standing == LeaderboardStanding(rank=2, previous_rank=1, session_count=1, friend_ahead_name="ctxrival")


def test_sessions_before_the_local_week_do_not_count(client):
    me, friend = _producer(client, "ctxweek"), _producer(client, "ctxweekfriend")
    _befriend(me, friend)
    _add_session(friend, datetime(2026, 6, 7, 20, 0, tzinfo=timezone.utc))

    assert _load(me).leaderboard.rank == 1


# --- deliveries -------------------------------------------------------------------------------


def test_recent_deliveries_feed_the_send_limits(client):
    me = _producer(client, "ctxlimits")
    with SessionLocal() as db:
        db.add(NotificationDelivery(user_id=me, notification_type="streak_at_risk", sent_at=NOW - timedelta(hours=2)))
        db.add(NotificationDelivery(user_id=me, notification_type="reengagement", sent_at=NOW - timedelta(days=5)))
        db.commit()

    assert [d.notification_type for d in _load(me).recent_deliveries] == ["streak_at_risk"]


# --- return outlook ---------------------------------------------------------------------------


def test_the_return_outlook_is_stored_with_yesterdays_value_as_baseline(client):
    me = _producer(client, "ctxoutlook")
    _add_session(me, NOW - timedelta(days=2))
    yesterday, later_today = NOW - timedelta(days=1), NOW + timedelta(hours=1)
    with SessionLocal() as db:
        first = load_engagement_context(db, me, yesterday)
        record_return_outlook(db, first, yesterday)
        db.commit()
        today = load_engagement_context(db, me, NOW)
        record_return_outlook(db, today, NOW)
        db.commit()
        again = load_engagement_context(db, me, later_today)
        row = db.get(UserEngagementProfile, me)

    assert first.previous_return_probability is None
    assert today.previous_return_probability == first.return_probability
    assert again.previous_return_probability == first.return_probability
    assert row.return_probability_24h == today.return_probability
    assert row.segment == today.segment.value == "new_user"
