from types import SimpleNamespace
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.services import session_lifecycle_service
from app.services.session_lifecycle_service import resolve_pause_started_at


class RollbackTrackingSession:
    def __init__(self) -> None:
        self.rolled_back = False

    def rollback(self) -> None:
        self.rolled_back = True


def test_unique_session_recovers_concurrent_session_after_integrity_error(monkeypatch) -> None:
    db = RollbackTrackingSession()
    active_results = iter([None, SimpleNamespace(id=99)])
    monkeypatch.setattr(
        session_lifecycle_service,
        "find_active_session",
        lambda _db, _user_id: next(active_results),
    )
    monkeypatch.setattr(
        session_lifecycle_service,
        "create_session",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            IntegrityError("insert session", {}, RuntimeError("unique constraint"))
        ),
    )

    with pytest.raises(session_lifecycle_service.ActiveSessionExistsError) as raised:
        session_lifecycle_service.create_unique_active_session(db, 7, "mixing")

    assert db.rolled_back is True
    assert raised.value.session_id == 99


def test_pause_started_at_keeps_the_moment_they_left() -> None:
    started = datetime(2026, 10, 6, 16, 0, tzinfo=timezone.utc)
    now = datetime(2026, 10, 6, 20, 0, tzinfo=timezone.utc)
    left = datetime(2026, 10, 6, 19, 50, tzinfo=timezone.utc)
    assert resolve_pause_started_at(started_at=started, requested=left, now=now) == left


def test_pause_started_at_defaults_to_now() -> None:
    started = datetime(2026, 10, 6, 16, 0, tzinfo=timezone.utc)
    now = datetime(2026, 10, 6, 20, 0, tzinfo=timezone.utc)
    assert resolve_pause_started_at(started_at=started, requested=None, now=now) == now


def test_pause_started_at_does_not_precede_session_start() -> None:
    started = datetime(2026, 10, 6, 19, 0, tzinfo=timezone.utc)
    now = datetime(2026, 10, 6, 20, 0, tzinfo=timezone.utc)
    requested = datetime(2026, 10, 6, 18, 0, tzinfo=timezone.utc)
    assert resolve_pause_started_at(started_at=started, requested=requested, now=now) == started


def test_pause_started_at_does_not_go_beyond_now() -> None:
    started = datetime(2026, 10, 6, 16, 0, tzinfo=timezone.utc)
    now = datetime(2026, 10, 6, 20, 0, tzinfo=timezone.utc)
    requested = datetime(2026, 10, 6, 21, 0, tzinfo=timezone.utc)
    assert resolve_pause_started_at(started_at=started, requested=requested, now=now) == now


def test_pause_started_at_lookback_is_capped() -> None:
    started = datetime(2026, 10, 5, 0, 0, tzinfo=timezone.utc)
    now = datetime(2026, 10, 6, 20, 0, tzinfo=timezone.utc)
    requested = datetime(2026, 10, 5, 1, 0, tzinfo=timezone.utc)
    paused_at = resolve_pause_started_at(started_at=started, requested=requested, now=now)
    assert paused_at == now - timedelta(hours=12)

