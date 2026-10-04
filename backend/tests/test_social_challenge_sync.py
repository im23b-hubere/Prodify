import json
from datetime import timedelta

import pytest

from app.config import settings
from app.database import SessionLocal
from app.models import SocialChallenge, utcnow
from tests.auth_helpers import auth_headers as _auth_headers
from tests.test_social import (
    _accept_challenge,
    _challenge_for_user,
    _complete_long_session,
    _duel,
    _make_friends,
)


@pytest.fixture
def sent_pushes(monkeypatch):
    sent: list[dict] = []

    def record_push(_settings, user_id, title, body, data, *, label):
        sent.append({"user_id": user_id, "title": title, "body": body, "data": data, "label": label})

    monkeypatch.setattr("app.services.social_challenge_notifications.schedule_push_to_user", record_push)
    return sent


def _group_challenge(client, headers, *, title: str, member_ids: list[int], target: int = 3) -> dict:
    created = client.post(
        "/social/challenges",
        headers=headers,
        json={
            "challenge_kind": "team",
            "title": title,
            "target_sessions": target,
            "duration_days": 7,
            "member_user_ids": member_ids,
        },
    )
    assert created.status_code == 200
    return created.json()


def _move_window_into_past(challenge_id: int, *, days_ago: int = 10) -> None:
    with SessionLocal() as db:
        row = db.get(SocialChallenge, challenge_id)
        assert row is not None
        started = utcnow() - timedelta(days=days_ago)
        row.week_start = started.date().isoformat()
        row.created_at = started
        meta = json.loads(row.meta_json or "{}")
        meta["started_at"] = started.isoformat()
        row.meta_json = json.dumps(meta)
        db.commit()


def _three_friends(client, prefix: str):
    a = _auth_headers(client, f"{prefix}-a@example.com", f"{prefix}-a")
    b = _auth_headers(client, f"{prefix}-b@example.com", f"{prefix}-b")
    c = _auth_headers(client, f"{prefix}-c@example.com", f"{prefix}-c")
    _make_friends(client, a, b, f"{prefix}-b")
    _make_friends(client, a, c, f"{prefix}-c")
    _make_friends(client, b, c, f"{prefix}-c")
    return a, b, c


def test_a_friends_duel_with_someone_else_stays_private(client):
    a, b, c = _three_friends(client, "sync-private")
    duel = _duel(client, a, title="A vs C", friend_id=3)
    _accept_challenge(client, c, duel["id"])

    listed = client.get("/social/challenges", headers=b).json()
    assert all(item["id"] != duel["id"] for item in listed)
    assert client.get(f"/social/challenges/{duel['id']}", headers=b).status_code == 403


def test_a_friends_open_group_challenge_stays_discoverable(client):
    a, b, _ = _three_friends(client, "sync-group")
    group = _group_challenge(client, a, title="Team Week", member_ids=[3])

    listed = client.get("/social/challenges", headers=b).json()
    assert any(item["id"] == group["id"] for item in listed)


def test_own_active_duel_is_listed_even_behind_many_newer_finished_ones(client):
    a = _auth_headers(client, "sync-crowd-a@example.com", "sync-crowd-a")
    b = _auth_headers(client, "sync-crowd-b@example.com", "sync-crowd-b")
    _make_friends(client, a, b, "sync-crowd-b")
    running = _duel(client, a, title="Still running")
    _accept_challenge(client, b, running["id"])

    with SessionLocal() as db:
        for index in range(45):
            db.add(
                SocialChallenge(
                    owner_id=1,
                    challenge_kind="duel",
                    title=f"Old {index}",
                    week_start="2026-01-05",
                    target_sessions=3,
                    status="cancelled",
                    meta_json=json.dumps({"completion_reason": "withdrawn"}),
                    created_at=utcnow() + timedelta(seconds=index + 1),
                )
            )
        db.commit()

    assert _challenge_for_user(client, a, running["id"])["status"] == "active"


def test_declined_invite_stays_visible_to_the_owner_with_its_reason(client, sent_pushes):
    a = _auth_headers(client, "sync-decline-a@example.com", "sync-decline-a")
    b = _auth_headers(client, "sync-decline-b@example.com", "sync-decline-b")
    _make_friends(client, a, b, "sync-decline-b")
    invite = _duel(client, a, title="Nope")

    assert client.post(f"/social/challenges/{invite['id']}/decline", headers=b).status_code == 204

    listed = _challenge_for_user(client, a, invite["id"])
    assert listed["status"] == "cancelled"
    assert listed["completion_reason"] == "declined"
    assert [push["user_id"] for push in sent_pushes if push["label"] == "challenge-cancelled"] == [1]


def test_declined_invite_reaches_the_owner_inbox(client):
    a = _auth_headers(client, "sync-inbox-a@example.com", "sync-inbox-a")
    b = _auth_headers(client, "sync-inbox-b@example.com", "sync-inbox-b")
    _make_friends(client, a, b, "sync-inbox-b")
    invite = _duel(client, a, title="Inbox Nope")
    client.post(f"/social/challenges/{invite['id']}/decline", headers=b)

    owner_inbox = client.get("/notifications/inbox?limit=40", headers=a).json()
    item = next(row for row in owner_inbox if row["id"] == f"challenge-cancelled-{invite['id']}")
    assert item["title_key"] == "notificationsUi.challengeDeclinedTitle"
    assert item["body_params"]["username"] == "sync-inbox-b"
    invitee_inbox = client.get("/notifications/inbox?limit=40", headers=b).json()
    assert all(row["id"] != f"challenge-cancelled-{invite['id']}" for row in invitee_inbox)


def test_winning_a_duel_notifies_both_sides(client, sent_pushes):
    a = _auth_headers(client, "sync-win-a@example.com", "sync-win-a")
    b = _auth_headers(client, "sync-win-b@example.com", "sync-win-b")
    _make_friends(client, a, b, "sync-win-b")
    duel = client.post(
        "/social/challenges",
        headers=a,
        json={
            "challenge_kind": "duel",
            "title": "First one",
            "target_sessions": 1,
            "duration_days": 7,
            "member_user_ids": [2],
        },
    ).json()
    _accept_challenge(client, b, duel["id"])
    sent_pushes.clear()

    _complete_long_session(client, a, minutes=12)

    finished = {push["user_id"]: push for push in sent_pushes if push["label"] == "challenge-finished"}
    assert set(finished) == {1, 2}
    assert finished[1]["data"]["path"] == f"/challenge/{duel['id']}"
    assert "won" in finished[1]["body"].lower()


def test_expired_duels_are_finalized_by_the_job(client, sent_pushes, monkeypatch):
    monkeypatch.setattr(settings, "internal_job_key", "job-secret")
    a = _auth_headers(client, "sync-job-a@example.com", "sync-job-a")
    b = _auth_headers(client, "sync-job-b@example.com", "sync-job-b")
    _make_friends(client, a, b, "sync-job-b")
    duel = _duel(client, a, title="Timed out")
    _accept_challenge(client, b, duel["id"])
    _complete_long_session(client, a, minutes=12)
    _move_window_into_past(duel["id"])
    sent_pushes.clear()

    response = client.post("/jobs/social-challenges", headers={"X-Internal-Job-Key": "job-secret"})

    assert response.status_code == 200
    assert response.json()["finished"] == 1
    with SessionLocal() as db:
        assert db.get(SocialChallenge, duel["id"]).status == "completed"
    assert {push["user_id"] for push in sent_pushes if push["label"] == "challenge-finished"} == {1, 2}


def test_duel_records_count_a_duel_that_just_ran_out(client):
    a = _auth_headers(client, "sync-rec-a@example.com", "sync-rec-a")
    b = _auth_headers(client, "sync-rec-b@example.com", "sync-rec-b")
    _make_friends(client, a, b, "sync-rec-b")
    duel = _duel(client, a, title="Ran out")
    _accept_challenge(client, b, duel["id"])
    _complete_long_session(client, a, minutes=12)
    _move_window_into_past(duel["id"])

    records = client.get("/social/challenges/records", headers=a).json()
    assert records == [{"friend_user_id": 2, "wins": 1, "losses": 0, "ties": 0}]


def test_running_duel_terms_are_locked_after_accept(client):
    a = _auth_headers(client, "sync-lock-a@example.com", "sync-lock-a")
    b = _auth_headers(client, "sync-lock-b@example.com", "sync-lock-b")
    _make_friends(client, a, b, "sync-lock-b")
    duel = _duel(client, a, title="Fair play")
    _accept_challenge(client, b, duel["id"])

    shortened = client.patch(f"/social/challenges/{duel['id']}", headers=a, json={"duration_days": 3})
    retargeted = client.patch(f"/social/challenges/{duel['id']}", headers=a, json={"target_sessions": 9})
    renamed = client.patch(f"/social/challenges/{duel['id']}", headers=a, json={"title": "Fair play 2"})

    assert shortened.status_code == 409
    assert retargeted.status_code == 409
    assert renamed.status_code == 200


def test_lowering_a_group_target_to_the_leaders_progress_finishes_it(client):
    a, b, _ = _three_friends(client, "sync-target")
    group = _group_challenge(client, a, title="Lower it", member_ids=[2], target=5)
    _complete_long_session(client, b, minutes=12)
    _complete_long_session(client, b, minutes=12)

    updated = client.patch(f"/social/challenges/{group['id']}", headers=a, json={"target_sessions": 2})

    assert updated.status_code == 200
    assert updated.json()["status"] == "completed"
    assert updated.json()["winner_user_id"] == 2


def test_group_duration_cannot_end_in_the_past(client):
    a, _, _ = _three_friends(client, "sync-duration")
    group = _group_challenge(client, a, title="Too short", member_ids=[2])
    _move_window_into_past(group["id"], days_ago=5)

    shortened = client.patch(f"/social/challenges/{group['id']}", headers=a, json={"duration_days": 3})

    assert shortened.status_code == 400


def test_deleting_a_credited_session_takes_the_point_back(client):
    a = _auth_headers(client, "sync-delete-a@example.com", "sync-delete-a")
    b = _auth_headers(client, "sync-delete-b@example.com", "sync-delete-b")
    _make_friends(client, a, b, "sync-delete-b")
    duel = _duel(client, a, title="No farming")
    _accept_challenge(client, b, duel["id"])
    session_id = _complete_long_session(client, a, minutes=12)

    assert client.delete(f"/sessions/item/{session_id}", headers=a).status_code == 204
    after_delete = _challenge_for_user(client, a, duel["id"])
    assert next(m for m in after_delete["members"] if m["user_id"] == 1)["progress_sessions"] == 0

    assert client.post(f"/sessions/item/{session_id}/restore", headers=a).status_code == 200
    after_restore = _challenge_for_user(client, a, duel["id"])
    assert next(m for m in after_restore["members"] if m["user_id"] == 1)["progress_sessions"] == 1


def test_session_credits_explain_why_a_session_did_not_count(client):
    a = _auth_headers(client, "sync-why-a@example.com", "sync-why-a")
    b = _auth_headers(client, "sync-why-b@example.com", "sync-why-b")
    _make_friends(client, a, b, "sync-why-b")
    duel = _duel(client, a, title="Explain it")
    pending_session = _complete_long_session(client, a, minutes=12)
    _accept_challenge(client, b, duel["id"])
    short_session = _complete_long_session(client, a, minutes=2)
    counted_session = _complete_long_session(client, a, minutes=12)

    def credit_for(session_id: int) -> dict:
        response = client.get(f"/social/challenges/sessions/{session_id}/credits", headers=a)
        assert response.status_code == 200
        return next(item for item in response.json() if item["challenge_id"] == duel["id"])

    assert credit_for(pending_session)["reason"] == "before_start"
    assert credit_for(short_session)["reason"] == "too_short"
    counted = credit_for(counted_session)
    assert counted["credited"] is True
    assert counted["progress_sessions"] == 1
    assert counted["target_sessions"] == 3


def test_session_credits_are_private_to_the_session_owner(client):
    a = _auth_headers(client, "sync-why-own-a@example.com", "sync-why-own-a")
    b = _auth_headers(client, "sync-why-own-b@example.com", "sync-why-own-b")
    _make_friends(client, a, b, "sync-why-own-b")
    session_id = _complete_long_session(client, a, minutes=12)

    assert client.get(f"/social/challenges/sessions/{session_id}/credits", headers=b).status_code == 404
