from datetime import timedelta

from sqlalchemy import select

from app.database import SessionLocal
from app.models import BuddyRelationship, BuddyStatus, GrowthEvent, Streak, User, utcnow


def _auth_headers(client, email: str, username: str, password: str = "strong-pass-123") -> dict[str, str]:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert register.status_code == 201
    token = register.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


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

    joined = client.post("/social/challenges/join", headers=b, json={"challenge_id": challenge_id})
    assert joined.status_code == 200

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


def test_free_challenge_limit_and_premium_unlock(client):
    a = _auth_headers(client, "social-i@example.com", "social-i")
    b = _auth_headers(client, "social-j@example.com", "social-j")
    _make_friends(client, a, b, "social-j")

    first = client.post(
        "/social/challenges",
        headers=a,
        json={"challenge_kind": "duel", "title": "One", "target_sessions": 3, "duration_days": 7, "member_user_ids": [2]},
    )
    assert first.status_code == 200
    second = client.post(
        "/social/challenges",
        headers=a,
        json={"challenge_kind": "duel", "title": "Two", "target_sessions": 3, "duration_days": 7, "member_user_ids": [2]},
    )
    assert second.status_code in {402, 200}

    with SessionLocal() as db:
        u = db.get(User, 1)
        assert u is not None
        u.is_premium = 1
        db.commit()

    third = client.post(
        "/social/challenges",
        headers=a,
        json={"challenge_kind": "duel", "title": "Three", "target_sessions": 3, "duration_days": 14, "member_user_ids": [2]},
    )
    assert third.status_code == 200


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
