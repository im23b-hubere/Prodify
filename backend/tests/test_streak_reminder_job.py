from datetime import datetime, timezone

import pytest

from app.database import SessionLocal
from app.jobs.send_streak_reminders import (
    SLOT_HALF_HOUR_LEFT,
    SLOT_ONE_HOUR_LEFT,
    SLOT_TWO_HOURS_LEFT,
    pick_reminder_slot,
    run_streak_reminder_job,
)
from app.models import ProductionSession, PushToken, StreakReminderDispatchLog, User


def test_reminder_slots_follow_the_local_wall_clock():
    assert pick_reminder_slot(datetime(2026, 8, 12, 22, 10)) == SLOT_TWO_HOURS_LEFT
    assert pick_reminder_slot(datetime(2026, 8, 12, 23, 10)) == SLOT_ONE_HOUR_LEFT
    assert pick_reminder_slot(datetime(2026, 8, 12, 23, 30)) == SLOT_HALF_HOUR_LEFT
    assert pick_reminder_slot(datetime(2026, 8, 12, 12, 0)) is None
    assert pick_reminder_slot(datetime(2026, 8, 13, 0, 5)) is None


@pytest.fixture
def sent_pushes(client, monkeypatch):
    sent: list[int] = []

    def fake_dispatch(_settings, _db, user_id, _title, _body, data=None):
        sent.append(user_id)
        return 1, 1, None

    monkeypatch.setattr("app.jobs.send_streak_reminders.dispatch_to_user", fake_dispatch)
    return sent


def _producer_with_streak(username: str, zone: str, session_started_utc: datetime, token_active: int = 1) -> int:
    with SessionLocal() as db:
        user = User(email=f"{username}@example.com", username=username, timezone=zone)
        db.add(user)
        db.flush()
        db.add(
            ProductionSession(
                user_id=user.id,
                started_at=session_started_utc,
                stopped_at=session_started_utc,
                duration_seconds=1800,
            )
        )
        db.add(PushToken(user_id=user.id, token=f"ExponentPushToken[{username}]", is_active=token_active))
        db.commit()
        return user.id


def _run_job_at(now_utc: datetime) -> dict:
    with SessionLocal() as db:
        return run_streak_reminder_job(db, settings=None, now=now_utc)


def test_reminds_only_users_whose_local_evening_has_reached_a_slot(sent_pushes):
    yesterday = datetime(2026, 8, 11, 16, 0, tzinfo=timezone.utc)
    berlin = _producer_with_streak("berlin", "Europe/Berlin", yesterday)
    _producer_with_streak("newyork", "America/New_York", yesterday)

    result = _run_job_at(datetime(2026, 8, 12, 20, 5, tzinfo=timezone.utc))  # 22:05 Berlin, 16:05 New York

    assert sent_pushes == [berlin]
    assert result["reminders_sent"] == 1


def test_never_reminds_after_local_midnight_even_when_it_is_still_evening_in_utc(sent_pushes):
    berlin_morning = datetime(2026, 8, 12, 8, 0, tzinfo=timezone.utc)
    _producer_with_streak("night-owl", "Europe/Berlin", berlin_morning)

    _run_job_at(datetime(2026, 8, 12, 22, 5, tzinfo=timezone.utc))  # 00:05 next day in Berlin

    assert sent_pushes == []


def test_sends_each_slot_at_most_once_per_local_day(sent_pushes):
    yesterday = datetime(2026, 8, 11, 16, 0, tzinfo=timezone.utc)
    _producer_with_streak("repeat", "Europe/Berlin", yesterday)

    _run_job_at(datetime(2026, 8, 12, 20, 2, tzinfo=timezone.utc))
    second = _run_job_at(datetime(2026, 8, 12, 20, 15, tzinfo=timezone.utc))

    assert len(sent_pushes) == 1
    assert second["skipped_already_sent_or_duplicate"] == 1
    with SessionLocal() as db:
        log = db.query(StreakReminderDispatchLog).one()
        assert log.day_key == "2026-08-12"


def test_skips_users_whose_push_tokens_are_all_inactive(sent_pushes):
    yesterday = datetime(2026, 8, 11, 16, 0, tzinfo=timezone.utc)
    _producer_with_streak("unreachable", "Europe/Berlin", yesterday, token_active=0)

    result = _run_job_at(datetime(2026, 8, 12, 20, 5, tzinfo=timezone.utc))

    assert sent_pushes == []
    assert result["users_with_tokens"] == 0


def test_users_without_timezone_use_utc_evenings(sent_pushes):
    yesterday = datetime(2026, 8, 11, 16, 0, tzinfo=timezone.utc)
    utc_user = _producer_with_streak("no-zone", None, yesterday)

    _run_job_at(datetime(2026, 8, 12, 22, 5, tzinfo=timezone.utc))

    assert sent_pushes == [utc_user]
