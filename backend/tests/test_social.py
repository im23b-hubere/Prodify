import json
from datetime import datetime, timedelta

from sqlalchemy import select

from app.database import SessionLocal
from app.models import BuddyRelationship, BuddyStatus, CheckinLog, GrowthEvent, ProductionSession, SocialChallenge, Streak, User, utcnow
from app.services.social_challenge_service import complete_challenge


from tests.auth_helpers import auth_headers as _auth_headers


def _make_friends(client, h1: dict[str, str], h2: dict[str, str], u2_name: str):
    req = client.post("/friends/request", headers=h1, json={"username": u2_name})
    assert req.status_code == 201
    fid = req.json()["id"]
    accepted = client.post(f"/friends/{fid}/accept", headers=h2)
    assert accepted.status_code == 200


def test_buddy_invite_accept_and_duplicate_prevention(client):
    a = _auth_headers(client, "social-a@example.com", "social-a")
    b = _auth_headers(client, "social-b@example.com", "social-b")
    _make_friends(client, a, b, "social-b")

    status0 = client.get("/social/buddy", headers=a)
    assert status0.status_code == 200
    assert status0.json()["status"] == "none"

    invite = client.post("/social/buddy/invite", headers=a, json={"friend_user_id": 2})
    assert invite.status_code == 200
    assert invite.json()["status"] == "pending_outgoing"

    dupe = client.post("/social/buddy/invite", headers=a, json={"friend_user_id": 2})
    assert dupe.status_code == 409

    accept = client.post("/social/buddy/accept", headers=b, json={"invite_id": invite.json()["invite_id"]})
    assert accept.status_code == 200
    assert accept.json()["status"] == "active"


def test_buddy_rules_are_translated_to_stable_http_errors(client):
    a = _auth_headers(client, "buddy-rules-a@example.com", "buddy-rules-a")
    _auth_headers(client, "buddy-rules-b@example.com", "buddy-rules-b")

    self_invite = client.post("/social/buddy/invite", headers=a, json={"friend_user_id": 1})
    non_friend = client.post("/social/buddy/invite", headers=a, json={"friend_user_id": 2})
    missing_invite = client.post("/social/buddy/accept", headers=a, json={"invite_id": 9999})

    assert self_invite.status_code == 400
    assert non_friend.status_code == 403
    assert missing_invite.status_code == 404


def test_checkin_plan_done_and_states(client):
    a = _auth_headers(client, "social-c@example.com", "social-c")
    set_plan = client.post("/social/checkins/plan", headers=a, json={"target_checkins": 3})
    assert set_plan.status_code == 200
    body = set_plan.json()
    assert body["target_checkins"] == 3
    assert len(body["day_states"]) == 7

    done = client.post("/social/checkins/done", headers=a, json={"note": "done"})
    assert done.status_code == 200
    d = done.json()
    assert d["done_count"] >= 1
    states = {s["state"] for s in d["day_states"]}
    assert "done" in states
    assert "open" in states or "missed" in states


def test_session_stop_marks_daily_checkin_done(client):
    a = _auth_headers(client, "social-checkin-auto@example.com", "social-checkin-auto")

    started = client.post("/sessions/quick-start", headers=a, json={"session_type": "beat_making"})
    assert started.status_code == 201
    sid = started.json()["id"]

    today_key = utcnow().date().isoformat()
    with SessionLocal() as db:
        before = db.scalar(select(CheckinLog).where(CheckinLog.user_id == 1, CheckinLog.day_key == today_key))
        assert before is None

    stopped = client.post("/sessions/stop", headers=a, json={"session_id": sid})
    assert stopped.status_code == 200

    with SessionLocal() as db:
        after = db.scalar(select(CheckinLog).where(CheckinLog.user_id == 1, CheckinLog.day_key == today_key))
        assert after is not None
        assert after.state == "done"


def test_commitment_status_behind_and_completed(client):
    a = _auth_headers(client, "social-d@example.com", "social-d")

    behind = client.post(
        "/social/commitment",
        headers=a,
        json={"target_sessions": 50, "visibility": "friends"},
    )
    assert behind.status_code == 200
    assert behind.json()["status"] in {"behind", "on_track"}

    one = client.post(
        "/social/commitment",
        headers=a,
        json={"target_sessions": 1, "visibility": "friends"},
    )
    assert one.status_code == 200

    started = client.post("/sessions/quick-start", headers=a, json={"session_type": "beat_making"})
    assert started.status_code == 201
    sid = started.json()["id"]
    stopped = client.post("/sessions/stop", headers=a, json={"session_id": sid})
    assert stopped.status_code == 200

    status = client.get("/social/commitment", headers=a)
    assert status.status_code == 200
    assert status.json()["status"] == "completed"

    with SessionLocal() as db:
        witness_events = db.scalars(
            select(GrowthEvent).where(
                GrowthEvent.user_id == 1,
                GrowthEvent.event_name == "commitment_witness_notified",
            )
        ).all()
        assert len(witness_events) >= 1


def test_streak_rescue_rules_and_limit(client):
    a = _auth_headers(client, "social-e@example.com", "social-e")
    b = _auth_headers(client, "social-f@example.com", "social-f")
    _make_friends(client, a, b, "social-f")
    invite = client.post("/social/buddy/invite", headers=a, json={"friend_user_id": 2})
    assert invite.status_code == 200
    accepted = client.post("/social/buddy/accept", headers=b, json={"invite_id": invite.json()["invite_id"]})
    assert accepted.status_code == 200

    with SessionLocal() as db:
        row = db.scalar(select(Streak).where(Streak.user_id == 2))
        if row is None:
            row = Streak(user_id=2, current_streak=3, longest_streak=3, frozen_day_keys="[]", freezes_remaining=1, billing_month="")
            db.add(row)
        else:
            row.current_streak = 3
            row.longest_streak = max(int(row.longest_streak or 0), 3)
            row.frozen_day_keys = "[]"
        db.commit()

    risk = client.get("/social/buddy/risk", headers=a)
    assert risk.status_code == 200

    rescue = client.post("/social/streak/rescue", headers=a, json={"rescued_user_id": 2})
    assert rescue.status_code == 200

    same_day = client.post("/social/streak/rescue", headers=a, json={"rescued_user_id": 2})
    assert same_day.status_code == 400


def test_social_challenge_comment_recap_and_leaderboard_context(client):
    a = _auth_headers(client, "social-g@example.com", "social-g")
    b = _auth_headers(client, "social-h@example.com", "social-h")
    _make_friends(client, a, b, "social-h")

    ch = client.post(
        "/social/challenges",
        headers=a,
        json={
            "challenge_kind": "duel",
            "title": "Beat Sprint",
            "target_sessions": 4,
            "member_user_ids": [2],
        },
    )
    assert ch.status_code == 200
    challenge_id = ch.json()["id"]
    assert len(ch.json()["members"]) >= 1

    _accept_challenge(client, b, challenge_id)

    start = client.post("/sessions/quick-start", headers=a, json={"session_type": "beat_making"})
    assert start.status_code == 201
    sid = start.json()["id"]
    stop = client.post("/sessions/stop", headers=a, json={"session_id": sid})
    assert stop.status_code == 200

    comment = client.post(f"/social/feed/{sid}/comments", headers=b, json={"body": "Strong run!"})
    assert comment.status_code == 200
    comments = client.get(f"/social/feed/{sid}/comments", headers=a)
    assert comments.status_code == 200
    assert len(comments.json()) >= 1

    recap = client.get("/social/weekly-recap", headers=a)
    assert recap.status_code == 200
    assert "has_active_buddy" in recap.json()

    context = client.get("/social/leaderboard/context", headers=a)
    assert context.status_code == 200
    assert isinstance(context.json()["entries"], list)


def test_social_challenge_join_requires_owner_friendship(client):
    owner = _auth_headers(client, "social-join-owner@example.com", "social-join-owner")
    friend = _auth_headers(client, "social-join-friend@example.com", "social-join-friend")
    stranger = _auth_headers(client, "social-join-stranger@example.com", "social-join-stranger")
    _make_friends(client, owner, friend, "social-join-friend")

    ch = client.post(
        "/social/challenges",
        headers=owner,
        json={
            "challenge_kind": "duel",
            "title": "Friends Only Join",
            "target_sessions": 4,
            "member_user_ids": [2],
        },
    )
    assert ch.status_code == 200
    challenge_id = ch.json()["id"]

    blocked = client.post("/social/challenges/join", headers=stranger, json={"challenge_id": challenge_id})
    assert blocked.status_code == 403
    friend_join = client.post("/social/challenges/join", headers=friend, json={"challenge_id": challenge_id})
    assert friend_join.status_code == 403


def test_unpaid_user_cannot_create_a_challenge(client):
    unpaid = _auth_headers(client, "social-free@example.com", "social-free", subscriber=False)
    blocked = client.post(
        "/social/challenges",
        headers=unpaid,
        json={
            "challenge_kind": "duel",
            "title": "One",
            "target_sessions": 3,
            "duration_days": 7,
            "member_user_ids": [1],
        },
    )
    assert blocked.status_code == 402


def test_subscriber_challenge_capacity(client):
    a = _auth_headers(client, "social-i@example.com", "social-i")
    b = _auth_headers(client, "social-j@example.com", "social-j")
    _make_friends(client, a, b, "social-j")

    last_status = None
    created = 0
    for index in range(8):
        response = client.post(
            "/social/challenges",
            headers=a,
            json={
                "challenge_kind": "duel",
                "title": f"Challenge {index}",
                "target_sessions": 3,
                "duration_days": 14,
                "member_user_ids": [2],
            },
        )
        last_status = response.status_code
        if response.status_code == 200:
            created += 1
            accepted = client.post(
                f"/social/challenges/{response.json()['id']}/accept",
                headers=b,
            )
            assert accepted.status_code == 200
            continue
        break

    assert created >= 3
    assert last_status == 409


def test_friend_accept_grants_growth_perks(client):
    a = _auth_headers(client, "social-k@example.com", "social-k")
    b = _auth_headers(client, "social-l@example.com", "social-l")
    req = client.post("/friends/request", headers=a, json={"username": "social-l"})
    assert req.status_code == 201
    fid = req.json()["id"]
    accepted = client.post(f"/friends/{fid}/accept", headers=b)
    assert accepted.status_code == 200

    with SessionLocal() as db:
        ua = db.get(User, 1)
        ub = db.get(User, 2)
        assert ua is not None and ub is not None
        assert int(ua.bonus_rescues or 0) >= 1
        assert int(ub.bonus_rescues or 0) >= 1


def test_identity_endpoint_and_recap_identity_tag(client):
    a = _auth_headers(client, "social-m@example.com", "social-m")
    b = _auth_headers(client, "social-n@example.com", "social-n")
    _make_friends(client, a, b, "social-n")

    invite = client.post("/social/buddy/invite", headers=a, json={"friend_user_id": 2})
    assert invite.status_code == 200
    accepted = client.post("/social/buddy/accept", headers=b, json={"invite_id": invite.json()["invite_id"]})
    assert accepted.status_code == 200

    start = client.post("/sessions/quick-start", headers=a, json={"session_type": "beat_making"})
    assert start.status_code == 201
    sid = start.json()["id"]
    stop = client.post("/sessions/stop", headers=a, json={"session_id": sid})
    assert stop.status_code == 200
    comment = client.post(f"/social/feed/{sid}/comments", headers=b, json={"body": "nice"})
    assert comment.status_code == 200

    ident = client.get("/social/identity", headers=b)
    assert ident.status_code == 200
    assert ident.json()["primary_tag"] in {
        "creator",
        "consistent_creator",
        "collaborative",
        "competitive",
        "locked_in",
        "building_momentum",
    }

    recap = client.get("/social/weekly-recap", headers=b)
    assert recap.status_code == 200
    assert "identity_tag" in recap.json()


def test_streak_break_creates_social_consequence_event_once(client):
    a = _auth_headers(client, "social-o@example.com", "social-o")
    b = _auth_headers(client, "social-p@example.com", "social-p")
    _make_friends(client, a, b, "social-p")

    with SessionLocal() as db:
        row = db.scalar(select(Streak).where(Streak.user_id == 1))
        assert row is not None
        row.current_streak = 6
        row.longest_streak = max(int(row.longest_streak or 0), 6)
        row.last_session_date = utcnow() - timedelta(days=2)
        db.commit()

    first = client.post("/streak/reconcile", headers=a)
    assert first.status_code == 204
    second = client.post("/streak/reconcile", headers=a)
    assert second.status_code == 204

    with SessionLocal() as db:
        events = db.scalars(
            select(GrowthEvent).where(
                GrowthEvent.user_id == 1,
                GrowthEvent.event_name == "streak_broken",
            )
        ).all()
        assert len(events) == 1


def test_streak_encourage_requires_friend_and_creates_event(client):
    a = _auth_headers(client, "social-q@example.com", "social-q")
    b = _auth_headers(client, "social-r@example.com", "social-r")
    _make_friends(client, a, b, "social-r")

    encourage = client.post("/social/streak/encourage", headers=a, json={"rescued_user_id": 2})
    assert encourage.status_code == 200

    with SessionLocal() as db:
        events = db.scalars(
            select(GrowthEvent).where(
                GrowthEvent.user_id == 1,
                GrowthEvent.event_name == "streak_encouragement_sent",
            )
        ).all()
        assert len(events) >= 1


def test_commitment_witness_selection_persists_and_returns(client):
    a = _auth_headers(client, "social-s@example.com", "social-s")
    b = _auth_headers(client, "social-t@example.com", "social-t")
    _make_friends(client, a, b, "social-t")

    created = client.post(
        "/social/commitment",
        headers=a,
        json={
            "target_sessions": 4,
            "visibility": "friends",
            "commitment_key": "sessions",
            "period_days": 7,
            "witness_user_ids": [2],
        },
    )
    assert created.status_code == 200

    status = client.get("/social/commitment", headers=a)
    assert status.status_code == 200
    body = status.json()
    assert "witness_user_ids" in body
    assert 2 in body["witness_user_ids"]
    assert "witness_usernames" in body
    assert "social-t" in body["witness_usernames"]

    commitments = client.get("/social/commitments", headers=a)
    assert commitments.status_code == 200
    assert len(commitments.json()) == 1
    assert commitments.json()[0]["commitment_key"] == "sessions"
    assert commitments.json()[0]["witness_user_ids"] == [2]


def _complete_long_session(client, headers: dict[str, str], *, minutes: int = 10) -> int:
    started = client.post("/sessions/quick-start", headers=headers, json={"session_type": "beat_making"})
    assert started.status_code == 201
    sid = started.json()["id"]
    with SessionLocal() as db:
        row = db.get(ProductionSession, sid)
        assert row is not None
        row.started_at = utcnow() - timedelta(minutes=minutes)
        db.commit()
    stopped = client.post("/sessions/stop", headers=headers, json={"session_id": sid})
    assert stopped.status_code == 200
    return sid


def _accept_challenge(client, headers: dict[str, str], challenge_id: int) -> dict:
    accepted = client.post(f"/social/challenges/{challenge_id}/accept", headers=headers)
    assert accepted.status_code == 200
    return accepted.json()


def _challenge_for_user(client, headers: dict[str, str], challenge_id: int) -> dict:
    listed = client.get("/social/challenges", headers=headers)
    assert listed.status_code == 200
    for item in listed.json():
        if item["id"] == challenge_id:
            return item
    raise AssertionError(f"challenge {challenge_id} not listed")


def test_social_challenge_progress_syncs_from_completed_session(client):
    a = _auth_headers(client, "social-ch-a@example.com", "social-ch-a")
    b = _auth_headers(client, "social-ch-b@example.com", "social-ch-b")
    _make_friends(client, a, b, "social-ch-b")

    created = client.post(
        "/social/challenges",
        headers=a,
        json={
            "challenge_kind": "duel",
            "title": "Progress Sync",
            "target_sessions": 3,
            "duration_days": 7,
            "member_user_ids": [2],
        },
    )
    assert created.status_code == 200
    challenge_id = created.json()["id"]
    _accept_challenge(client, b, challenge_id)

    _complete_long_session(client, a, minutes=12)
    detail = _challenge_for_user(client, a, challenge_id)
    me = next(m for m in detail["members"] if m["user_id"] == 1)
    assert me["progress_sessions"] == 1
    assert detail["status"] == "active"
    assert detail["leader_user_id"] == 1


def test_social_challenge_completes_when_target_reached(client):
    a = _auth_headers(client, "social-ch-win-a@example.com", "social-ch-win-a")
    b = _auth_headers(client, "social-ch-win-b@example.com", "social-ch-win-b")
    _make_friends(client, a, b, "social-ch-win-b")

    created = client.post(
        "/social/challenges",
        headers=a,
        json={
            "challenge_kind": "duel",
            "title": "Quick Win",
            "target_sessions": 1,
            "duration_days": 7,
            "member_user_ids": [2],
        },
    )
    assert created.status_code == 200
    challenge_id = created.json()["id"]
    _accept_challenge(client, b, challenge_id)

    _complete_long_session(client, a, minutes=12)
    detail = _challenge_for_user(client, a, challenge_id)
    assert detail["status"] == "completed"
    assert detail["winner_user_id"] == 1
    assert detail["completion_reason"] == "target_reached"


def test_social_challenge_expires_with_leader_on_time_up(client):
    a = _auth_headers(client, "social-ch-exp-a@example.com", "social-ch-exp-a")
    b = _auth_headers(client, "social-ch-exp-b@example.com", "social-ch-exp-b")
    _make_friends(client, a, b, "social-ch-exp-b")

    created = client.post(
        "/social/challenges",
        headers=a,
        json={
            "challenge_kind": "duel",
            "title": "Time Up",
            "target_sessions": 5,
            "duration_days": 7,
            "member_user_ids": [2],
        },
    )
    assert created.status_code == 200
    challenge_id = created.json()["id"]
    _accept_challenge(client, b, challenge_id)

    _complete_long_session(client, a, minutes=12)
    with SessionLocal() as db:
        row = db.get(SocialChallenge, challenge_id)
        assert row is not None
        expired_start = utcnow() - timedelta(days=10)
        row.week_start = expired_start.date().isoformat()
        row.created_at = expired_start
        meta = json.loads(row.meta_json or "{}")
        meta["started_at"] = expired_start.isoformat()
        row.meta_json = json.dumps(meta)
        db.commit()

    listed = client.get("/social/challenges", headers=a)
    assert listed.status_code == 200
    detail = next(item for item in listed.json() if item["id"] == challenge_id)
    assert detail["status"] == "completed"
    assert detail["winner_user_id"] == 1
    assert detail["completion_reason"] == "time_expired"


def test_social_challenge_get_by_id(client):
    a = _auth_headers(client, "social-ch-get-a@example.com", "social-ch-get-a")
    b = _auth_headers(client, "social-ch-get-b@example.com", "social-ch-get-b")
    stranger = _auth_headers(client, "social-ch-get-s@example.com", "social-ch-get-s")
    _make_friends(client, a, b, "social-ch-get-b")

    created = client.post(
        "/social/challenges",
        headers=a,
        json={
            "challenge_kind": "duel",
            "title": "Detail View",
            "target_sessions": 4,
            "duration_days": 7,
            "member_user_ids": [2],
        },
    )
    assert created.status_code == 200
    challenge_id = created.json()["id"]

    detail = client.get(f"/social/challenges/{challenge_id}", headers=b)
    assert detail.status_code == 200
    assert detail.json()["title"] == "Detail View"
    assert detail.json()["owner_id"] == 1

    blocked = client.get(f"/social/challenges/{challenge_id}", headers=stranger)
    assert blocked.status_code == 403


def test_social_challenge_owner_can_update_and_cancel(client):
    a = _auth_headers(client, "social-ch-edit-a@example.com", "social-ch-edit-a")
    b = _auth_headers(client, "social-ch-edit-b@example.com", "social-ch-edit-b")
    _make_friends(client, a, b, "social-ch-edit-b")

    created = client.post(
        "/social/challenges",
        headers=a,
        json={
            "challenge_kind": "duel",
            "title": "Editable Duel",
            "target_sessions": 5,
            "duration_days": 7,
            "member_user_ids": [2],
        },
    )
    assert created.status_code == 200
    challenge_id = created.json()["id"]
    assert created.json()["owner_id"] == 1
    _accept_challenge(client, b, challenge_id)

    updated = client.patch(
        f"/social/challenges/{challenge_id}",
        headers=a,
        json={"title": "Renamed Duel", "target_sessions": 6},
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["title"] == "Renamed Duel"
    assert body["target_sessions"] == 6

    forbidden = client.patch(
        f"/social/challenges/{challenge_id}",
        headers=b,
        json={"title": "Hijacked"},
    )
    assert forbidden.status_code == 403

    cancelled = client.delete(f"/social/challenges/{challenge_id}", headers=a)
    assert cancelled.status_code == 204
    listed = client.get("/social/challenges", headers=a)
    assert listed.status_code == 200
    assert all(item["id"] != challenge_id for item in listed.json())


def test_social_challenge_target_cannot_drop_below_progress(client):
    a = _auth_headers(client, "social-ch-floor-a@example.com", "social-ch-floor-a")
    b = _auth_headers(client, "social-ch-floor-b@example.com", "social-ch-floor-b")
    _make_friends(client, a, b, "social-ch-floor-b")

    created = client.post(
        "/social/challenges",
        headers=a,
        json={
            "challenge_kind": "duel",
            "title": "Floor Test",
            "target_sessions": 5,
            "duration_days": 7,
            "member_user_ids": [2],
        },
    )
    assert created.status_code == 200
    challenge_id = created.json()["id"]
    _accept_challenge(client, b, challenge_id)
    _complete_long_session(client, a, minutes=12)
    _complete_long_session(client, a, minutes=12)

    blocked = client.patch(
        f"/social/challenges/{challenge_id}",
        headers=a,
        json={"target_sessions": 1},
    )
    assert blocked.status_code == 400


def test_social_challenge_member_can_leave_and_owner_cannot(client):
    a = _auth_headers(client, "social-ch-leave-a@example.com", "social-ch-leave-a")
    b = _auth_headers(client, "social-ch-leave-b@example.com", "social-ch-leave-b")
    _make_friends(client, a, b, "social-ch-leave-b")

    created = client.post(
        "/social/challenges",
        headers=a,
        json={
            "challenge_kind": "duel",
            "title": "Leave Test",
            "target_sessions": 5,
            "duration_days": 7,
            "member_user_ids": [2],
        },
    )
    assert created.status_code == 200
    challenge_id = created.json()["id"]
    _accept_challenge(client, b, challenge_id)

    owner_leave = client.post(f"/social/challenges/{challenge_id}/leave", headers=a)
    assert owner_leave.status_code == 400

    member_leave = client.post(f"/social/challenges/{challenge_id}/leave", headers=b)
    assert member_leave.status_code == 204

    listed = client.get("/social/challenges", headers=a)
    assert listed.status_code == 200
    assert all(item["id"] != challenge_id for item in listed.json())


def _duel(client, headers: dict[str, str], *, title: str, friend_id: int = 2) -> dict:
    created = client.post(
        "/social/challenges",
        headers=headers,
        json={
            "challenge_kind": "duel",
            "title": title,
            "target_sessions": 3,
            "duration_days": 7,
            "member_user_ids": [friend_id],
        },
    )
    assert created.status_code == 200
    return created.json()


def test_duel_stays_pending_until_the_invitee_accepts(client):
    a = _auth_headers(client, "social-inv-a@example.com", "social-inv-a")
    b = _auth_headers(client, "social-inv-b@example.com", "social-inv-b")
    outsider = _auth_headers(client, "social-inv-c@example.com", "social-inv-c")
    _make_friends(client, a, b, "social-inv-b")
    _make_friends(client, a, outsider, "social-inv-c")

    created = _duel(client, a, title="Invite First")
    assert created["status"] == "pending"
    assert created["invitee_user_id"] == 2
    assert [member["user_id"] for member in created["members"]] == [1]
    assert created["days_remaining"] == 0

    _complete_long_session(client, a, minutes=12)
    still_pending = _challenge_for_user(client, a, created["id"])
    assert still_pending["members"][0]["progress_sessions"] == 0

    owner_accept = client.post(f"/social/challenges/{created['id']}/accept", headers=a)
    assert owner_accept.status_code == 403
    outsider_list = client.get("/social/challenges", headers=outsider)
    assert all(item["id"] != created["id"] for item in outsider_list.json())
    invitee_list = client.get("/social/challenges", headers=b)
    assert any(item["id"] == created["id"] for item in invitee_list.json())

    accepted = _accept_challenge(client, b, created["id"])
    assert accepted["status"] == "active"
    assert {member["user_id"] for member in accepted["members"]} == {1, 2}
    again = _accept_challenge(client, b, created["id"])
    assert again["status"] == "active"

    _complete_long_session(client, a, minutes=12)
    started = _challenge_for_user(client, a, created["id"])
    me = next(member for member in started["members"] if member["user_id"] == 1)
    assert me["progress_sessions"] == 1


def test_invitee_sees_the_invite_even_when_many_unrelated_challenges_exist(client):
    a = _auth_headers(client, "social-many-a@example.com", "social-many-a")
    b = _auth_headers(client, "social-many-b@example.com", "social-many-b")
    _auth_headers(client, "social-many-stranger@example.com", "social-many-stranger")
    _make_friends(client, a, b, "social-many-b")
    invite = _duel(client, a, title="Needle")

    with SessionLocal() as db:
        for index in range(45):
            db.add(
                SocialChallenge(
                    owner_id=3,
                    challenge_kind="team",
                    title=f"Noise {index}",
                    week_start="2026-09-28",
                    target_sessions=3,
                    status="active",
                    meta_json="{}",
                    created_at=utcnow() + timedelta(seconds=index + 1),
                )
            )
        db.commit()

    listed = client.get("/social/challenges", headers=b)
    assert listed.status_code == 200
    assert any(item["id"] == invite["id"] for item in listed.json())


def test_invitee_can_still_decline_after_unfriending_but_cannot_accept(client):
    a = _auth_headers(client, "social-unfriend-a@example.com", "social-unfriend-a")
    b = _auth_headers(client, "social-unfriend-b@example.com", "social-unfriend-b")
    request = client.post("/friends/request", headers=a, json={"username": "social-unfriend-b"})
    friendship_id = request.json()["id"]
    assert client.post(f"/friends/{friendship_id}/accept", headers=b).status_code == 200
    invite = _duel(client, a, title="Gone")
    assert client.delete(f"/friends/{friendship_id}", headers=b).status_code == 204

    assert client.post(f"/social/challenges/{invite['id']}/accept", headers=b).status_code == 403
    assert client.post(f"/social/challenges/{invite['id']}/decline", headers=b).status_code == 204


def test_duel_invite_reaches_the_invitee_inbox(client):
    a = _auth_headers(client, "social-ping-a@example.com", "social-ping-a")
    b = _auth_headers(client, "social-ping-b@example.com", "social-ping-b")
    _make_friends(client, a, b, "social-ping-b")
    invite = _duel(client, a, title="Ping Duel")

    inbox = client.get("/notifications/inbox?limit=40", headers=b)
    item = next(row for row in inbox.json() if row["id"] == f"duel-invite-{invite['id']}")
    assert item["body_params"] == {"username": "social-ping-a"}
    owner_inbox = client.get("/notifications/inbox?limit=40", headers=a)
    assert all(not row["id"].startswith("duel-invite-") for row in owner_inbox.json())

    _accept_challenge(client, b, invite["id"])
    after = client.get("/notifications/inbox?limit=40", headers=b)
    assert all(not row["id"].startswith("duel-invite-") for row in after.json())


def test_accepted_duel_reaches_the_owner_inbox(client):
    a = _auth_headers(client, "social-news-a@example.com", "social-news-a")
    b = _auth_headers(client, "social-news-b@example.com", "social-news-b")
    _make_friends(client, a, b, "social-news-b")

    created = _duel(client, a, title="Inbox Duel")
    assert created["invitee_username"] == "social-news-b"
    accepted = _accept_challenge(client, b, created["id"])
    assert {member["user_id"] for member in accepted["members"]} == {1, 2}
    assert all("profile_picture_url" in member for member in accepted["members"])

    inbox = client.get("/notifications/inbox?limit=40", headers=a)
    assert inbox.status_code == 200
    item = next(row for row in inbox.json() if row["id"] == f"duel-accepted-{created['id']}")
    assert item["body_params"] == {"username": "social-news-b"}
    invitee_inbox = client.get("/notifications/inbox?limit=40", headers=b)
    assert all(not row["id"].startswith("duel-accepted-") for row in invitee_inbox.json())


def test_duel_invite_exposes_expiry_only_while_pending(client):
    a = _auth_headers(client, "social-ttl-a@example.com", "social-ttl-a")
    b = _auth_headers(client, "social-ttl-b@example.com", "social-ttl-b")
    _make_friends(client, a, b, "social-ttl-b")

    created = _duel(client, a, title="Countdown")
    expires_at = datetime.fromisoformat(created["invite_expires_at"])
    remaining = expires_at - datetime.now(expires_at.tzinfo)
    assert timedelta(hours=47) < remaining <= timedelta(hours=48)

    accepted = _accept_challenge(client, b, created["id"])
    assert accepted["invite_expires_at"] is None


def _finish_duel(challenge_id: int, *, winner_user_id: int | None, is_tie: bool = False) -> None:
    with SessionLocal() as db:
        row = db.get(SocialChallenge, challenge_id)
        assert row is not None
        complete_challenge(db, row, winner_user_id=winner_user_id, reason="time_expired", is_tie=is_tie)
        db.commit()


def test_duel_records_tally_lifetime_results_per_opponent(client):
    a = _auth_headers(client, "social-rec-a@example.com", "social-rec-a")
    b = _auth_headers(client, "social-rec-b@example.com", "social-rec-b")
    c = _auth_headers(client, "social-rec-c@example.com", "social-rec-c")
    _make_friends(client, a, b, "social-rec-b")
    _make_friends(client, a, c, "social-rec-c")

    won = _duel(client, a, title="Won vs B")
    _accept_challenge(client, b, won["id"])
    _finish_duel(won["id"], winner_user_id=1)
    tied = _duel(client, a, title="Tie vs B")
    _accept_challenge(client, b, tied["id"])
    _finish_duel(tied["id"], winner_user_id=None, is_tie=True)
    lost = _duel(client, a, title="Lost vs C", friend_id=3)
    _accept_challenge(client, c, lost["id"])
    _finish_duel(lost["id"], winner_user_id=3)
    _duel(client, a, title="Still pending")

    records = client.get("/social/challenges/records", headers=a)
    assert records.status_code == 200
    assert records.json() == [
        {"friend_user_id": 2, "wins": 1, "losses": 0, "ties": 1},
        {"friend_user_id": 3, "wins": 0, "losses": 1, "ties": 0},
    ]
    from_b = client.get("/social/challenges/records", headers=b).json()
    assert from_b == [{"friend_user_id": 1, "wins": 0, "losses": 1, "ties": 1}]


def test_duel_invite_can_be_declined_or_withdrawn_and_not_duplicated(client):
    a = _auth_headers(client, "social-dec-a@example.com", "social-dec-a")
    b = _auth_headers(client, "social-dec-b@example.com", "social-dec-b")
    _make_friends(client, a, b, "social-dec-b")

    first = _duel(client, a, title="Waiting")
    duplicate = client.post(
        "/social/challenges",
        headers=a,
        json={
            "challenge_kind": "duel",
            "title": "Again",
            "target_sessions": 3,
            "member_user_ids": [2],
        },
    )
    assert duplicate.status_code == 409

    declined = client.post(f"/social/challenges/{first['id']}/decline", headers=b)
    assert declined.status_code == 204
    listed = client.get("/social/challenges", headers=a)
    assert all(item["id"] != first["id"] for item in listed.json())

    second = _duel(client, a, title="Withdraw Me")
    withdrawn = client.delete(f"/social/challenges/{second['id']}", headers=a)
    assert withdrawn.status_code == 204
    owner_decline = client.post(f"/social/challenges/{second['id']}/decline", headers=a)
    assert owner_decline.status_code == 400


def test_duel_invite_expires_after_48_hours(client):
    a = _auth_headers(client, "social-exp-a@example.com", "social-exp-a")
    b = _auth_headers(client, "social-exp-b@example.com", "social-exp-b")
    _make_friends(client, a, b, "social-exp-b")

    created = _duel(client, a, title="Stale Invite")
    with SessionLocal() as db:
        row = db.get(SocialChallenge, created["id"])
        assert row is not None
        meta = json.loads(row.meta_json or "{}")
        meta["invited_at"] = (utcnow() - timedelta(hours=49)).isoformat()
        row.meta_json = json.dumps(meta)
        db.commit()

    listed = client.get("/social/challenges", headers=b)
    assert all(item["id"] != created["id"] for item in listed.json())
    expired = client.post(f"/social/challenges/{created['id']}/accept", headers=b)
    assert expired.status_code == 400
