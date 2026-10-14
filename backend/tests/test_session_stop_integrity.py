"""Stopping a session records believable time exactly once, however the stop arrives."""

from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.jobs.enforce_session_presence import _stop
from app.models import ProductionSession, utcnow
from app.services.session_presence import SESSION_AUTO_STOP_SECONDS
from tests.auth_helpers import auth_headers
from tests.test_session_presence_job import _backdate, _start_session


def _stop_via_api(client, headers: dict[str, str], session_id: int):
    return client.post("/sessions/stop", headers=headers, json={"session_id": session_id})


def test_stopping_a_forgotten_session_counts_at_most_eight_hours(client):
    headers = auth_headers(client, "stop-cap@example.com", "stop-cap")
    session_id = _start_session(client, headers)
    _backdate(session_id, hours=20)

    response = _stop_via_api(client, headers, session_id)

    assert response.status_code == 200
    assert response.json()["duration_seconds"] == SESSION_AUTO_STOP_SECONDS


def test_stopping_twice_returns_the_finished_session(client):
    headers = auth_headers(client, "stop-twice@example.com", "stop-twice")
    session_id = _start_session(client, headers)
    first = _stop_via_api(client, headers, session_id)

    second = _stop_via_api(client, headers, session_id)

    assert second.status_code == 200
    assert second.json()["stopped_at"] == first.json()["stopped_at"]
    assert second.json()["duration_seconds"] == first.json()["duration_seconds"]


def test_auto_stop_leaves_a_session_alone_that_the_user_stopped_meanwhile(client, monkeypatch):
    monkeypatch.setattr("app.jobs.enforce_session_presence.dispatch_to_user", lambda *args, **kwargs: (0, 0, None))
    headers = auth_headers(client, "stop-race@example.com", "stop-race")
    session_id = _start_session(client, headers)
    _backdate(session_id, hours=9)

    with SessionLocal() as job_db:
        stale = job_db.scalar(select(ProductionSession).where(ProductionSession.id == session_id))
        user_stopped = _stop_via_api(client, headers, session_id).json()

        assert _stop(job_db, settings, stale, utcnow()) is False

    with SessionLocal() as db:
        session = db.get(ProductionSession, session_id)
        assert session is not None
        assert session.duration_seconds == user_stopped["duration_seconds"]
