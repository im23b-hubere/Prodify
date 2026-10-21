"""The friends week ranking uses the shared UTC week, the same one buddy uses."""

from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import ProductionSession

from tests.auth_helpers import auth_headers


WEDNESDAY = datetime(2026, 10, 21, 15, 0, tzinfo=timezone.utc)
SUNDAY_BEFORE_MONDAY = datetime(2026, 10, 18, 12, 0, tzinfo=timezone.utc)
MONDAY = datetime(2026, 10, 19, 12, 0, tzinfo=timezone.utc)


def test_week_leaderboard_counts_the_utc_week_and_matches_buddy(client, monkeypatch):
    _freeze_social_clock(monkeypatch)
    alice, bob = _friends_and_buddies(client, "week-alice", "week-bob")
    alice_id = _user_id(client, alice)
    _store_completed_session(alice_id, SUNDAY_BEFORE_MONDAY, duration_seconds=1800)
    _store_completed_session(alice_id, MONDAY, duration_seconds=60)

    week = client.get("/friends/leaderboard?period=week", headers=alice)
    assert week.status_code == 200, week.text
    alice_row = _entry(week.json()["entries"], "week-alice")
    assert alice_row["sessions_in_period"] == 1
    assert alice_row["sessions_delta_vs_prior"] == 0
    assert alice_row["trend"] == "flat"

    buddy = client.get("/social/buddy", headers=alice)
    assert buddy.status_code == 200, buddy.text
    assert buddy.json()["this_week_sessions"] == 1
    assert buddy.json()["buddy_week_sessions"] == 0

    overall = client.get("/friends/leaderboard?period=all", headers=alice)
    assert _entry(overall.json()["entries"], "week-alice")["sessions_in_period"] == 2
    assert _entry(overall.json()["entries"], "week-bob")["sessions_in_period"] == 0


def test_equal_week_sessions_rank_the_longer_personal_streak_first(client, monkeypatch):
    _freeze_social_clock(monkeypatch)
    _freeze_personal_today(monkeypatch)
    alice, bob = _friends_and_buddies(client, "streak-alice", "streak-bob")
    alice_id = _user_id(client, alice)
    bob_id = _user_id(client, bob)
    for day in (19, 20, 21):
        moment = datetime(2026, 10, day, 12, 0, tzinfo=timezone.utc)
        _store_completed_session(alice_id, moment, duration_seconds=1800)
        _store_completed_session(bob_id, moment, duration_seconds=1800)
    for day in (17, 18):
        _store_completed_session(
            bob_id,
            datetime(2026, 10, day, 12, 0, tzinfo=timezone.utc),
            duration_seconds=1800,
        )

    week = client.get("/friends/leaderboard?period=week", headers=alice)
    assert week.status_code == 200, week.text
    rows = {entry["username"]: entry for entry in week.json()["entries"]}
    assert rows["streak-alice"]["sessions_in_period"] == 3
    assert rows["streak-bob"]["sessions_in_period"] == 3
    assert rows["streak-bob"]["current_streak_days"] == 5
    assert rows["streak-alice"]["current_streak_days"] == 3
    assert rows["streak-bob"]["rank"] == 1
    assert rows["streak-alice"]["rank"] == 2


def _freeze_social_clock(monkeypatch) -> None:
    monkeypatch.setattr("app.services.social_week_service.utcnow", lambda: WEDNESDAY)
    monkeypatch.setattr("app.services.friend_leaderboard_service.utcnow", lambda: WEDNESDAY)


def _freeze_personal_today(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.streak_calendar.today_in",
        lambda _zone: WEDNESDAY.date(),
    )


def _friends_and_buddies(client, alice_name: str, bob_name: str):
    alice = auth_headers(client, f"{alice_name}@example.com", alice_name)
    bob = auth_headers(client, f"{bob_name}@example.com", bob_name)
    requested = client.post("/friends/request", headers=alice, json={"username": bob_name})
    assert requested.status_code == 201, requested.text
    accepted = client.post(f"/friends/{requested.json()['id']}/accept", headers=bob)
    assert accepted.status_code == 200, accepted.text
    bob_id = _user_id(client, bob)
    invited = client.post("/social/buddy/invite", headers=alice, json={"friend_user_id": bob_id})
    assert invited.status_code == 200, invited.text
    activated = client.post(
        "/social/buddy/accept",
        headers=bob,
        json={"invite_id": invited.json()["invite_id"]},
    )
    assert activated.status_code == 200, activated.text
    return alice, bob


def _user_id(client, headers: dict[str, str]) -> int:
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    return me.json()["id"]


def _entry(entries: list[dict], username: str) -> dict:
    return next(entry for entry in entries if entry["username"] == username)


def _store_completed_session(user_id: int, started_at: datetime, *, duration_seconds: int) -> None:
    with SessionLocal() as db:
        db.add(
            ProductionSession(
                user_id=user_id,
                started_at=started_at,
                stopped_at=started_at + timedelta(seconds=duration_seconds),
                duration_seconds=duration_seconds,
                session_type="beat_making",
            )
        )
        db.commit()
