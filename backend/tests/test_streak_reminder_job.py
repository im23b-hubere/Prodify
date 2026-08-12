from datetime import datetime, timezone

from app.jobs.send_streak_reminders import (
    SLOT_STREAK_UTC_22,
    SLOT_STREAK_UTC_23,
    SLOT_STREAK_UTC_2330,
    pick_reminder_slot,
    run_streak_reminder_job,
)


def test_reminder_windows_are_explicit():
    assert pick_reminder_slot(datetime(2026, 8, 12, 22, 10, tzinfo=timezone.utc)) == SLOT_STREAK_UTC_22
    assert pick_reminder_slot(datetime(2026, 8, 12, 23, 10, tzinfo=timezone.utc)) == SLOT_STREAK_UTC_23
    assert pick_reminder_slot(datetime(2026, 8, 12, 23, 30, tzinfo=timezone.utc)) == SLOT_STREAK_UTC_2330
    assert pick_reminder_slot(datetime(2026, 8, 12, 12, 0, tzinfo=timezone.utc)) is None


def test_job_returns_without_querying_users_outside_window(monkeypatch):
    fixed_now = datetime(2026, 8, 12, 12, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("app.jobs.send_streak_reminders.utcnow", lambda: fixed_now)

    result = run_streak_reminder_job(db=None, settings=None)

    assert result["skipped_outside_window"] is True
    assert result["reminders_sent"] == 0
    assert result["utc_day_key"] == "2026-08-12"
