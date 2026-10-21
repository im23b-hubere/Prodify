from datetime import datetime, timedelta, timezone

from app.config import settings
from app.database import SessionLocal
from app.jobs.enforce_session_presence import run_session_presence_job
from app.models import ProductionSession, PushToken
from app.services.session_presence import SESSION_AUTO_STOP_SECONDS
from tests.auth_helpers import auth_headers


def _user_id(client, headers: dict[str, str]) -> int:
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    return int(me.json()["id"])


def _start_session(client, headers: dict[str, str]) -> int:
    started = client.post(
        "/sessions/start",
        headers=headers,
        json={"session_type": "beat_making"},
    )
    assert started.status_code == 201
    return int(started.json()["id"])


def _backdate(session_id: int, *, hours: float, paused_duration_seconds: int = 0) -> None:
    with SessionLocal() as db:
        session = db.get(ProductionSession, session_id)
        assert session is not None
        session.started_at = datetime.now(timezone.utc) - timedelta(hours=hours)
        session.paused_duration_seconds = paused_duration_seconds
        db.commit()


def _place_pause(session_id: int, *, started_hours_ago: float, paused_hours_ago: float) -> None:
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        session = db.get(ProductionSession, session_id)
        assert session is not None
        session.started_at = now - timedelta(hours=started_hours_ago)
        session.pause_started_at = now - timedelta(hours=paused_hours_ago)
        session.paused_duration_seconds = 0
        db.commit()


def _register_push_token(user_id: int) -> None:
    with SessionLocal() as db:
        db.add(
            PushToken(
                user_id=user_id,
                token="ExponentPushToken[presence-test]",
                platform="ios",
                channel="expo",
            )
        )
        db.commit()


def _run_job() -> dict:
    # An unclosed session stays idle in transaction on Postgres and blocks the next test's drop_all.
    with SessionLocal() as db:
        return run_session_presence_job(db, settings)


def test_job_nudges_after_three_hours_and_leaves_the_session_running(client, monkeypatch):
    headers = auth_headers(client, "presence-nudge@example.com", "presence-nudge")
    user_id = _user_id(client, headers)
    session_id = _start_session(client, headers)
    _backdate(session_id, hours=3)
    _register_push_token(user_id)
    pushes: list[tuple[str, str]] = []
    monkeypatch.setattr(
        "app.jobs.enforce_session_presence.dispatch_to_user",
        lambda settings, db, uid, title, body, data=None: pushes.append((title, body)) or (1, 1, None),
    )

    result = _run_job()

    assert result["nudged"] == 1
    assert result["stopped"] == 0
    assert pushes == [
        ("Still there?", "Your session is still running. Open Prodify to continue or end it."),
    ]
    with SessionLocal() as db:
        session = db.get(ProductionSession, session_id)
        assert session is not None
        assert session.stopped_at is None
        assert session.still_there_notified_at is not None


def test_job_does_not_repeat_the_nudge(client, monkeypatch):
    headers = auth_headers(client, "presence-nudge-once@example.com", "presence-nudge-once")
    session_id = _start_session(client, headers)
    _backdate(session_id, hours=4)
    with SessionLocal() as db:
        session = db.get(ProductionSession, session_id)
        assert session is not None
        session.still_there_notified_at = datetime.now(timezone.utc)
        db.commit()
    monkeypatch.setattr(
        "app.jobs.enforce_session_presence.dispatch_to_user",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("should not push")),
    )

    result = _run_job()

    assert result["nudged"] == 0
    assert result["stopped"] == 0


def test_job_stops_after_eight_hours_even_when_late(client, monkeypatch):
    headers = auth_headers(client, "presence-stop@example.com", "presence-stop")
    user_id = _user_id(client, headers)
    session_id = _start_session(client, headers)
    _backdate(session_id, hours=9)
    _register_push_token(user_id)
    pushes: list[tuple[str, str]] = []
    monkeypatch.setattr(
        "app.jobs.enforce_session_presence.dispatch_to_user",
        lambda settings, db, uid, title, body, data=None: pushes.append((title, body)) or (1, 1, None),
    )

    result = _run_job()

    assert result["stopped"] == 1
    assert pushes == [("Session ended", "Your session was stopped after 8 hours.")]
    with SessionLocal() as db:
        session = db.get(ProductionSession, session_id)
        assert session is not None
        assert session.stopped_at is not None
        assert session.duration_seconds == SESSION_AUTO_STOP_SECONDS


def test_job_stops_a_paused_session_after_eight_open_hours(client, monkeypatch):
    headers = auth_headers(client, "presence-paused-stop@example.com", "presence-paused-stop")
    manual_headers = auth_headers(client, "presence-paused-manual@example.com", "presence-paused-manual")
    session_id = _pause(client, headers)
    manual_id = _pause(client, manual_headers)
    _place_pause(session_id, started_hours_ago=10, paused_hours_ago=9)
    _place_pause(manual_id, started_hours_ago=10, paused_hours_ago=9)
    monkeypatch.setattr(
        "app.jobs.enforce_session_presence.dispatch_to_user",
        lambda *args, **kwargs: (0, 0, None),
    )

    manual = client.post("/sessions/stop", headers=manual_headers, json={"session_id": manual_id})
    result = _run_job()

    assert result["stopped"] == 1
    assert manual.status_code == 200
    with SessionLocal() as db:
        stopped = db.get(ProductionSession, session_id)
        by_hand = db.get(ProductionSession, manual_id)
        assert stopped is not None and by_hand is not None
        assert stopped.duration_seconds == 3600
        assert by_hand.duration_seconds == 3600
        assert _open_seconds(stopped) == _open_seconds(by_hand) == SESSION_AUTO_STOP_SECONDS
    started = client.post("/sessions/start", headers=headers, json={"session_type": "beat_making"})
    assert started.status_code == 201


def test_job_keeps_a_paused_session_under_eight_hours(client, monkeypatch):
    headers = auth_headers(client, "presence-paused-keep@example.com", "presence-paused-keep")
    session_id = _pause(client, headers)
    _place_pause(session_id, started_hours_ago=4, paused_hours_ago=3)
    monkeypatch.setattr(
        "app.jobs.enforce_session_presence.dispatch_to_user",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("should not push")),
    )

    result = _run_job()

    assert result == {"nudged": 0, "stopped": 0, "scanned": 1}
    conflict = client.post("/sessions/start", headers=headers, json={"session_type": "beat_making"})
    assert conflict.status_code == 409
    assert conflict.json()["error"]["details"]["session_id"] == session_id
    with SessionLocal() as db:
        session = db.get(ProductionSession, session_id)
        assert session is not None
        assert session.stopped_at is None
        assert session.pause_started_at is not None


def test_job_stops_a_session_paused_after_eight_hours_of_work(client, monkeypatch):
    headers = auth_headers(client, "presence-paused-full@example.com", "presence-paused-full")
    session_id = _pause(client, headers)
    _place_pause(session_id, started_hours_ago=8, paused_hours_ago=0)
    monkeypatch.setattr(
        "app.jobs.enforce_session_presence.dispatch_to_user",
        lambda *args, **kwargs: (0, 0, None),
    )

    result = _run_job()

    assert result["stopped"] == 1
    with SessionLocal() as db:
        session = db.get(ProductionSession, session_id)
        assert session is not None
        assert session.duration_seconds == SESSION_AUTO_STOP_SECONDS


def _pause(client, headers: dict[str, str]) -> int:
    session_id = _start_session(client, headers)
    paused = client.post(f"/sessions/item/{session_id}/pause", headers=headers, json={})
    assert paused.status_code == 200
    return session_id


def _open_seconds(session: ProductionSession) -> int:
    stopped_at = session.stopped_at
    started_at = session.started_at
    assert stopped_at is not None
    if stopped_at.tzinfo is None:
        stopped_at = stopped_at.replace(tzinfo=timezone.utc)
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    return int((stopped_at - started_at).total_seconds())


def test_job_still_stops_the_next_session_when_one_auto_stop_fails(client, monkeypatch):
    first_headers = auth_headers(client, "presence-fail@example.com", "presence-fail")
    second_headers = auth_headers(client, "presence-ok@example.com", "presence-ok")
    first_id = _start_session(client, first_headers)
    second_id = _start_session(client, second_headers)
    _backdate(first_id, hours=8)
    _backdate(second_id, hours=8)

    from app.services.session_lifecycle_service import complete_session as real_complete

    calls = {"count": 0}

    def flaky_complete(db, user_id, session, *, stopped_at=None):
        calls["count"] += 1
        if calls["count"] == 1:
            session.notes = "partial"
            db.flush()
            raise RuntimeError("xp grant failed")
        return real_complete(db, user_id, session, stopped_at=stopped_at)

    monkeypatch.setattr("app.jobs.enforce_session_presence.complete_session", flaky_complete)
    monkeypatch.setattr(
        "app.jobs.enforce_session_presence.dispatch_to_user",
        lambda *args, **kwargs: (0, 0, None),
    )

    result = _run_job()

    assert result["stopped"] == 1
    with SessionLocal() as db:
        first = db.get(ProductionSession, first_id)
        second = db.get(ProductionSession, second_id)
        assert first is not None and first.stopped_at is None
        assert first.notes != "partial"
        assert second is not None and second.stopped_at is not None
