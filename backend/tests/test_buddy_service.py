from types import SimpleNamespace

import pytest
from sqlalchemy.exc import IntegrityError

from app.services import buddy_service


class ConflictingBuddySession:
    def __init__(self) -> None:
        self.rolled_back = False

    def get(self, _model, _identifier):
        return SimpleNamespace(id=2)

    def add(self, _relationship) -> None:
        return None

    def commit(self) -> None:
        raise IntegrityError("insert buddy", {}, RuntimeError("unique constraint"))

    def rollback(self) -> None:
        self.rolled_back = True


def test_concurrent_buddy_invite_is_reported_as_unavailable(monkeypatch) -> None:
    db = ConflictingBuddySession()
    monkeypatch.setattr(buddy_service, "_are_friends", lambda *_args: True)
    monkeypatch.setattr(buddy_service, "current_buddy_relationship", lambda *_args: None)

    with pytest.raises(buddy_service.BuddyUnavailableError):
        buddy_service.invite_buddy(db, requester_id=1, invitee_id=2)

    assert db.rolled_back is True
