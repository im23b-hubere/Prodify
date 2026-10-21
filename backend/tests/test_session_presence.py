from datetime import datetime, timedelta, timezone

from app.services.session_presence import (
    SESSION_AUTO_STOP_SECONDS,
    SESSION_STILL_THERE_SECONDS,
    decide_session_presence,
    effective_elapsed_seconds,
    open_elapsed_seconds,
    session_presence_action,
    stop_deadline,
)


class _Session:
    def __init__(self, *, started_at, paused_duration_seconds=0, pause_started_at=None):
        self.started_at = started_at
        self.paused_duration_seconds = paused_duration_seconds
        self.pause_started_at = pause_started_at


STARTED = datetime(2026, 10, 6, 12, 0, tzinfo=timezone.utc)


def test_elapsed_excludes_completed_pauses() -> None:
    now = STARTED + timedelta(hours=4)
    session = _Session(started_at=STARTED, paused_duration_seconds=600)
    assert effective_elapsed_seconds(session, now) == 4 * 3600 - 600


def test_elapsed_freezes_while_paused() -> None:
    pause_at = STARTED + timedelta(hours=1)
    now = STARTED + timedelta(hours=5)
    session = _Session(started_at=STARTED, pause_started_at=pause_at)
    assert effective_elapsed_seconds(session, now) == 3600
    assert open_elapsed_seconds(session, now) == 5 * 3600


def test_paused_session_stops_at_eight_open_hours_without_a_nudge() -> None:
    pause_at = STARTED + timedelta(hours=1)
    session = _Session(started_at=STARTED, pause_started_at=pause_at)
    assert session_presence_action(session, STARTED + timedelta(hours=4)) == "none"
    assert session_presence_action(session, STARTED + timedelta(hours=8)) == "stop"


def test_presence_asks_after_three_hours() -> None:
    assert (
        decide_session_presence(
            SESSION_STILL_THERE_SECONDS,
            is_running=True,
            already_nudged=False,
        )
        == "nudge"
    )


def test_presence_does_not_repeat_nudge() -> None:
    assert (
        decide_session_presence(
            SESSION_STILL_THERE_SECONDS + 60,
            is_running=True,
            already_nudged=True,
        )
        == "none"
    )


def test_presence_stops_after_eight_hours() -> None:
    assert (
        decide_session_presence(
            SESSION_AUTO_STOP_SECONDS,
            is_running=True,
            already_nudged=True,
        )
        == "stop"
    )


def test_presence_skips_paused_sessions() -> None:
    assert (
        decide_session_presence(
            SESSION_AUTO_STOP_SECONDS,
            is_running=False,
            already_nudged=False,
        )
        == "none"
    )


def test_stop_deadline_caps_at_eight_hours_of_work() -> None:
    now = STARTED + timedelta(hours=9)
    session = _Session(started_at=STARTED)
    assert stop_deadline(session, now) == STARTED + timedelta(seconds=SESSION_AUTO_STOP_SECONDS)
