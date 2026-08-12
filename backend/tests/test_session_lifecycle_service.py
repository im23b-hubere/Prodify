from types import SimpleNamespace

import pytest
from sqlalchemy.exc import IntegrityError

from app.services import session_lifecycle_service


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
