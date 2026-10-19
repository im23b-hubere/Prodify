"""Social DB audit (#10): constraints, soft-delete engagement, deletion cleanup, batch streaks."""

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import (
    ContentReport,
    Friendship,
    FriendshipStatus,
    ProductionSession,
    SocialChallenge,
    SocialChallengeMember,
    SocialComment,
    SocialReaction,
    User,
    UserBlock,
    utcnow,
)
from tests.test_friends import _register


def test_soft_deleting_a_session_removes_its_social_engagement(client):
    owner = _register(client, "soft-del-owner@example.com", "softdelowner")
    friend = _register(client, "soft-del-friend@example.com", "softdelfriend")
    owner_id = client.get("/auth/me", headers={"Authorization": f"Bearer {owner}"}).json()["id"]
    friend_id = client.get("/auth/me", headers={"Authorization": f"Bearer {friend}"}).json()["id"]

    with SessionLocal() as db:
        session = ProductionSession(
            user_id=owner_id,
            session_type="recording",
            started_at=utcnow(),
            stopped_at=utcnow(),
            duration_seconds=600,
        )
        db.add(session)
        db.flush()
        db.add(SocialComment(target_type="session", target_id=session.id, author_id=friend_id, body="Nice"))
        db.add(SocialReaction(target_type="session", target_id=session.id, user_id=friend_id, emoji="👍"))
        db.commit()
        session_id = session.id

    deleted = client.delete(f"/sessions/item/{session_id}", headers={"Authorization": f"Bearer {owner}"})
    assert deleted.status_code == 204

    with SessionLocal() as db:
        assert db.scalar(select(SocialComment).where(SocialComment.target_id == session_id)) is None
        assert db.scalar(select(SocialReaction).where(SocialReaction.target_id == session_id)) is None
        assert db.get(ProductionSession, session_id).deleted_at is not None


def test_friendship_rejects_self_pair_at_database(client):
    token = _register(client, "self-friend@example.com", "selffriend")
    user_id = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["id"]

    with SessionLocal() as db:
        db.add(
            Friendship(
                user_id=user_id,
                friend_id=user_id,
                status=FriendshipStatus.pending,
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()


def test_friendship_rejects_reverse_duplicate_pair_at_database(client):
    t_a = _register(client, "canon-a@example.com", "canona")
    t_b = _register(client, "canon-b@example.com", "canonb")
    a_id = client.get("/auth/me", headers={"Authorization": f"Bearer {t_a}"}).json()["id"]
    b_id = client.get("/auth/me", headers={"Authorization": f"Bearer {t_b}"}).json()["id"]

    with SessionLocal() as db:
        db.add(Friendship(user_id=a_id, friend_id=b_id, status=FriendshipStatus.accepted))
        db.commit()

    with SessionLocal() as db:
        db.add(Friendship(user_id=b_id, friend_id=a_id, status=FriendshipStatus.pending))
        with pytest.raises(IntegrityError):
            db.commit()


def test_deleting_account_removes_owned_challenges_blocks_and_reports(client):
    owner = _register(client, "chal-owner@example.com", "chalowner")
    other = _register(client, "chal-other@example.com", "chalother")
    owner_id = client.get("/auth/me", headers={"Authorization": f"Bearer {owner}"}).json()["id"]
    other_id = client.get("/auth/me", headers={"Authorization": f"Bearer {other}"}).json()["id"]

    with SessionLocal() as db:
        challenge = SocialChallenge(
            owner_id=owner_id,
            title="Week duel",
            week_start="2026-10-13",
            target_sessions=5,
            status="active",
        )
        db.add(challenge)
        db.flush()
        db.add(SocialChallengeMember(challenge_id=challenge.id, user_id=other_id, progress_sessions=1))
        db.add(UserBlock(blocker_id=owner_id, blocked_id=other_id))
        db.add(
            ContentReport(
                reporter_id=other_id,
                reported_user_id=owner_id,
                target_type="user",
                content_snapshot="spammy",
                reason="spam",
                status="open",
            )
        )
        db.commit()
        challenge_id = challenge.id

    assert client.delete("/users/me", headers={"Authorization": f"Bearer {owner}"}).status_code == 204

    with SessionLocal() as db:
        assert db.get(SocialChallenge, challenge_id) is None
        assert (
            db.scalar(select(SocialChallengeMember).where(SocialChallengeMember.challenge_id == challenge_id))
            is None
        )
        assert (
            db.scalar(
                select(UserBlock).where(
                    UserBlock.blocker_id == owner_id,
                )
            )
            is None
        )
        assert (
            db.scalar(select(ContentReport).where(ContentReport.reported_user_id == owner_id)) is None
        )


def test_batch_streak_counts_match_per_user_lookup(client):
    from app.services.streak_reconcile_service import (
        compute_streak_counts_for_display,
        compute_streak_counts_for_users,
    )

    tokens = [
        _register(client, f"streak-batch-{i}@example.com", f"streakbatch{i}")
        for i in range(3)
    ]
    user_ids = [
        client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["id"]
        for token in tokens
    ]

    with SessionLocal() as db:
        for user_id in user_ids:
            db.add(
                ProductionSession(
                    user_id=user_id,
                    session_type="beat_making",
                    started_at=utcnow(),
                    stopped_at=utcnow(),
                    duration_seconds=300,
                )
            )
        db.commit()
        users = list(db.scalars(select(User).where(User.id.in_(user_ids))).all())
        expected = {user.id: compute_streak_counts_for_display(db, user.id) for user in users}
        assert compute_streak_counts_for_users(db, users) == expected
