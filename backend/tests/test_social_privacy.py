"""What friends may see of each other in the feed and inbox, and what a block reveals."""

from datetime import timedelta

from app.config import settings
from app.database import SessionLocal
from app.models import ContentReport, utcnow
from app.services import content_report_service
from tests.auth_helpers import auth_headers
from tests.test_social import _complete_long_session, _duel, _make_friends


def _user_id(client, headers: dict[str, str]) -> int:
    return client.get("/auth/me", headers=headers).json()["id"]


def _feed(client, headers: dict[str, str]) -> list[dict]:
    response = client.get("/friends/activity?limit=20", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _publish_commitment(client, headers: dict[str, str], visibility: str) -> None:
    response = client.post(
        "/social/commitment", headers=headers, json={"target_sessions": 3, "visibility": visibility}
    )
    assert response.status_code == 200, response.text


def test_feed_counters_ignore_blocked_users(client):
    host = auth_headers(client, "privacy-count-host@example.com", "privacy-count-host")
    alice = auth_headers(client, "privacy-count-a@example.com", "privacy-count-alice")
    bob = auth_headers(client, "privacy-count-b@example.com", "privacy-count-bob")
    _make_friends(client, host, alice, "privacy-count-alice")
    _make_friends(client, host, bob, "privacy-count-bob")
    session_id = _complete_long_session(client, host)
    client.post(f"/social/feed/{session_id}/reactions", headers=bob, json={"emoji": "🔥"})
    client.post(f"/social/feed/{session_id}/comments", headers=bob, json={"body": "nice"})

    client.post(f"/users/{_user_id(client, bob)}/block", headers=alice)

    item = next(row for row in _feed(client, alice) if row["session_id"] == session_id)
    assert (item["reactions_count"], item["comments_count"]) == (0, 0)


def test_buddy_only_commitment_stays_out_of_other_friends_feeds(client):
    alice = auth_headers(client, "privacy-buddy-a@example.com", "privacy-buddy-alice")
    bob = auth_headers(client, "privacy-buddy-b@example.com", "privacy-buddy-bob")
    _make_friends(client, alice, bob, "privacy-buddy-bob")

    _publish_commitment(client, alice, "buddy")

    assert not any(row["status"] == "commitment_published" for row in _feed(client, bob))
    assert any(row["status"] == "commitment_published" for row in _feed(client, alice))


def test_friends_commitment_appears_in_friends_feeds(client):
    alice = auth_headers(client, "privacy-public-a@example.com", "privacy-public-alice")
    bob = auth_headers(client, "privacy-public-b@example.com", "privacy-public-bob")
    _make_friends(client, alice, bob, "privacy-public-bob")

    _publish_commitment(client, alice, "friends")

    assert any(row["status"] == "commitment_published" for row in _feed(client, bob))


def test_blocked_user_is_not_told_who_ended_the_duel(client):
    alice = auth_headers(client, "privacy-duel-a@example.com", "privacy-duel-alice")
    bob = auth_headers(client, "privacy-duel-b@example.com", "privacy-duel-bob")
    _make_friends(client, alice, bob, "privacy-duel-bob")
    duel = _duel(client, alice, title="Showdown", friend_id=_user_id(client, bob))

    client.post(f"/users/{_user_id(client, alice)}/block", headers=bob)

    inbox = client.get("/notifications/inbox?limit=40", headers=alice).json()
    assert all(row["id"] != f"challenge-cancelled-{duel['id']}" for row in inbox)


def test_reporting_the_same_user_twice_files_one_report(client, monkeypatch):
    pushes: list[int] = []
    monkeypatch.setattr(content_report_service, "schedule_push_to_user", lambda *args, **kwargs: pushes.append(1))
    monkeypatch.setattr(settings, "moderator_user_ids", [1])
    alice = auth_headers(client, "privacy-report-a@example.com", "privacy-report-alice")
    bob_id = _user_id(client, auth_headers(client, "privacy-report-b@example.com", "privacy-report-bob"))
    payload = {"target_type": "user", "user_id": bob_id, "reason": "spam"}

    first = client.post("/reports", headers=alice, json=payload)
    second = client.post("/reports", headers=alice, json=payload)

    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert len(pushes) == 1
    with SessionLocal() as db:
        assert db.query(ContentReport).filter(ContentReport.reported_user_id == bob_id).count() == 1


def test_a_resolved_report_does_not_block_a_new_one(client):
    alice = auth_headers(client, "privacy-again-a@example.com", "privacy-again-alice")
    alice_id = _user_id(client, alice)
    bob_id = _user_id(client, auth_headers(client, "privacy-again-b@example.com", "privacy-again-bob"))
    with SessionLocal() as db:
        db.add(
            ContentReport(
                reporter_id=alice_id,
                reported_user_id=bob_id,
                target_type="user",
                content_snapshot="-",
                reason="spam",
                status="resolved",
                created_at=utcnow() - timedelta(days=3),
            )
        )
        db.commit()

    response = client.post("/reports", headers=alice, json={"target_type": "user", "user_id": bob_id, "reason": "spam"})

    assert response.status_code == 201
