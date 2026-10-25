"""The Apple review account: every screen a reviewer opens shows consistent data and works."""

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.database import SessionLocal
from app.models import User
from app.services.review_account_seed import (
    DemoAccountCollisionError,
    ReviewAccountSpec,
    ReviewSeedResult,
    seed_review_account,
)
from app.services.streak_reconcile_service import load_streak_snapshot
from app.streakutil import compute_current_streak
from tests.auth_helpers import auth_headers

SPEC = ReviewAccountSpec(
    email="app-review@example.org",
    username="prodifyreview",
    password="review-password-123",
    streak_days=64,
    level=12,
)


def _seed() -> ReviewSeedResult:
    with SessionLocal() as db:
        return seed_review_account(db, SPEC)


def _sign_in(client, email: str = SPEC.email, password: str = SPEC.password):
    return client.post("/auth/login", json={"email": email, "password": password})


def _reviewer(client) -> dict[str, str]:
    response = _sign_in(client)
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _challenges(client, headers: dict[str, str]) -> list[dict]:
    response = client.get("/social/challenges", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _latest_session_id(client, headers: dict[str, str]) -> int:
    sessions = client.get("/sessions/list", headers=headers).json()
    return max(session["id"] for session in sessions)


def test_reviewer_signs_in_with_the_given_password_and_passes_the_paywall(client):
    _seed()

    headers = _reviewer(client)

    assert client.get("/streak/overview", headers=headers).status_code == 200


def test_reviewer_sees_the_seeded_streak(client):
    _seed()

    overview = client.get("/streak/overview", headers=_reviewer(client)).json()

    assert overview["current_streak"] == SPEC.streak_days


def test_reviewer_streak_survives_three_review_days_without_a_session(client):
    result = _seed()

    with SessionLocal() as db:
        snapshot = load_streak_snapshot(db, result.reviewer_user_id)
    three_days_later = snapshot.calendar.today + timedelta(days=3)

    assert compute_current_streak(snapshot.merged_days, three_days_later) == SPEC.streak_days + 3


def test_reviewer_level_holds_after_the_app_syncs_progression(client):
    _seed()

    synced = client.post("/progression/sync", headers=_reviewer(client)).json()

    assert synced["current_level"] == SPEC.level


def test_every_friend_stands_on_the_rank_path_and_two_share_the_reviewers_level(client):
    _seed()

    friends = client.get("/friends/progression", headers=_reviewer(client)).json()["friends"]
    levels = [friend["level"] for friend in friends]

    assert friends
    assert all(1 <= level <= 20 for level in levels)
    assert levels.count(SPEC.level) >= 2


def test_reviewer_can_accept_a_waiting_friend_request(client):
    _seed()
    headers = _reviewer(client)

    incoming = client.get("/friends/incoming", headers=headers).json()
    accepted = client.post(f"/friends/{incoming[0]['id']}/accept", headers=headers)

    assert len(incoming) == 1
    assert accepted.status_code == 200


def test_reviewer_can_send_a_friend_request_to_the_open_profile(client):
    result = _seed()

    response = client.post(
        "/friends/request",
        headers=_reviewer(client),
        json={"username": result.open_profile_username},
    )

    assert response.status_code == 201, response.text


def test_reviewer_has_a_running_duel(client):
    _seed()

    duels = _challenges(client, _reviewer(client))

    assert any(duel["challenge_kind"] == "duel" and duel["status"] == "active" for duel in duels)


def test_reviewer_can_accept_a_duel_invite(client):
    result = _seed()
    headers = _reviewer(client)

    invite = next(
        duel
        for duel in _challenges(client, headers)
        if duel["status"] == "pending" and duel["invitee_user_id"] == result.reviewer_user_id
    )
    accepted = client.post(f"/social/challenges/{invite['id']}/accept", headers=headers)

    assert accepted.status_code == 200, accepted.text


def test_reviewer_has_an_active_buddy(client):
    _seed()

    buddy = client.get("/social/buddy", headers=_reviewer(client)).json()

    assert buddy["status"] == "active"


def test_reviewer_can_report_a_friends_comment_on_their_latest_session(client):
    _seed()
    headers = _reviewer(client)

    comments = client.get(
        f"/social/feed/{_latest_session_id(client, headers)}/comments", headers=headers
    ).json()
    report = client.post(
        "/reports",
        headers=headers,
        json={"target_type": "comment", "comment_id": comments[0]["id"], "reason": "spam"},
    )

    assert report.status_code == 201, report.text


def test_demo_producers_cannot_be_signed_into(client):
    _seed()

    with SessionLocal() as db:
        demo_emails = db.scalars(select(User.email).where(User.email != SPEC.email)).all()

    assert demo_emails
    assert all(_sign_in(client, email, SPEC.password).status_code == 401 for email in demo_emails)


def test_demo_producers_use_reserved_addresses_nobody_can_own(client):
    _seed()

    with SessionLocal() as db:
        demo_emails = db.scalars(select(User.email).where(User.email != SPEC.email)).all()

    assert all(email.endswith("@example.com") for email in demo_emails)


def test_reseeding_undoes_what_the_reviewer_blocked_and_accepted(client):
    _seed()
    headers = _reviewer(client)
    friend_id = client.get("/friends/progression", headers=headers).json()["friends"][0]["user_id"]
    client.post(f"/users/{friend_id}/block", headers=headers)
    incoming = client.get("/friends/incoming", headers=headers).json()
    client.post(f"/friends/{incoming[0]['id']}/accept", headers=headers)

    _seed()
    headers = _reviewer(client)

    assert client.get("/users/me/blocked", headers=headers).json() == []
    assert len(client.get("/friends/incoming", headers=headers).json()) == 1


def test_reseeding_recreates_an_account_the_reviewer_deleted(client):
    _seed()
    assert client.delete("/users/me", headers=_reviewer(client)).status_code == 204

    _seed()

    assert _sign_in(client).status_code == 200


def test_seed_refuses_to_take_over_a_real_account_holding_a_demo_username(client):
    auth_headers(client, "real-producer@example.org", "mila.waves")

    with pytest.raises(DemoAccountCollisionError):
        _seed()

    with SessionLocal() as db:
        real_producer = db.scalar(select(User).where(User.username == "mila.waves"))
    assert real_producer.email == "real-producer@example.org"
