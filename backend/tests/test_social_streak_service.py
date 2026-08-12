import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Streak, User
from app.services import social_streak_service


class ConflictingRescueSession:
    def __init__(self) -> None:
        self.rolled_back = False

    def scalar(self, _query):
        return Streak(user_id=2, current_streak=3, frozen_day_keys="[]")

    def add(self, _model) -> None:
        return None

    def commit(self) -> None:
        raise IntegrityError("insert rescue", {}, RuntimeError("unique constraint"))

    def rollback(self) -> None:
        self.rolled_back = True


def test_concurrent_same_day_rescue_rolls_back_as_domain_error(monkeypatch) -> None:
    db = ConflictingRescueSession()
    rescuer = User(id=1, email="rescuer@example.com", username="rescuer", hashed_password="hash")
    monkeypatch.setattr(social_streak_service, "_active_buddy_user_id", lambda *_args: 2)
    monkeypatch.setattr(social_streak_service, "_was_rescued_on_day", lambda *_args: False)
    monkeypatch.setattr(social_streak_service, "_weekly_rescue_count", lambda *_args: 0)
    monkeypatch.setattr(social_streak_service, "_weekly_rescue_limit", lambda *_args: 1)
    monkeypatch.setattr(social_streak_service, "grant_xp", lambda *_args, **_kwargs: None)

    with pytest.raises(social_streak_service.BuddyAlreadyRescuedError):
        social_streak_service.rescue_buddy_streak(db, rescuer, rescued_user_id=2)

    assert db.rolled_back is True
