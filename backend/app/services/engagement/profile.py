"""
A producer's behaviour, aggregated from their completed sessions.

`compute_profile` is pure: callers load the sessions and decide where the result is stored,
so the engine never has to scan raw history when it decides on a notification.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

from app.services.streak_calendar import StreakCalendar
from app.timeutil import as_utc_aware

# Cold start: how much the engine may rely on the producer's own pattern.
STAGE_COLD_START = 1  # 0-3 sessions: fixed, conservative defaults
STAGE_LEARNING = 2  # 4-10 sessions: own pattern blended with defaults
STAGE_ESTABLISHED = 3  # more than 10 sessions: own pattern

_LEARNING_FROM_SESSIONS = 4
_ESTABLISHED_FROM_SESSIONS = 11
_ROLLING_WEEKS = 4
_WEEK = timedelta(days=7)


class CompletedSession(Protocol):
    started_at: datetime
    duration_seconds: int | None


@dataclass(frozen=True)
class StartPattern:
    """When sessions start, in the producer's local time."""

    weekdays: Counter[int]
    hours: Counter[int]


def start_pattern(sessions: Iterable[CompletedSession], calendar: StreakCalendar) -> StartPattern:
    local_starts = [calendar.local_time_of(session.started_at) for session in sessions]
    return StartPattern(
        weekdays=Counter(moment.weekday() for moment in local_starts),
        hours=Counter(moment.hour for moment in local_starts),
    )


@dataclass(frozen=True)
class BehaviorProfile:
    total_sessions: int
    stage: int
    session_hour_histogram: list[int]
    weekday_histogram: list[int]
    avg_sessions_per_week: float
    avg_session_duration_minutes: float
    last_session_at: datetime | None
    sessions_last_7_days: int
    sessions_previous_7_days: int
    last_session_duration_minutes: float = 0

    def preferred_hours(self, limit: int = 3) -> list[int]:
        """The local hours the producer starts most often, busiest first."""
        ranked = sorted(range(24), key=lambda hour: -self.session_hour_histogram[hour])
        return [hour for hour in ranked[:limit] if self.session_hour_histogram[hour] > 0]

    def days_since_last_session(self, now: datetime) -> int | None:
        if self.last_session_at is None:
            return None
        return (as_utc_aware(now) - as_utc_aware(self.last_session_at)).days


def stage_for(total_sessions: int) -> int:
    if total_sessions >= _ESTABLISHED_FROM_SESSIONS:
        return STAGE_ESTABLISHED
    if total_sessions >= _LEARNING_FROM_SESSIONS:
        return STAGE_LEARNING
    return STAGE_COLD_START


def compute_profile(
    sessions: Sequence[CompletedSession],
    calendar: StreakCalendar,
    now: datetime,
) -> BehaviorProfile:
    pattern = start_pattern(sessions, calendar)
    starts = [as_utc_aware(session.started_at) for session in sessions]
    now = as_utc_aware(now)
    return BehaviorProfile(
        total_sessions=len(sessions),
        stage=stage_for(len(sessions)),
        session_hour_histogram=[pattern.hours[hour] for hour in range(24)],
        weekday_histogram=[pattern.weekdays[day] for day in range(7)],
        avg_sessions_per_week=_count_between(starts, now - _ROLLING_WEEKS * _WEEK, now) / _ROLLING_WEEKS,
        avg_session_duration_minutes=_average_minutes(sessions),
        last_session_at=max(starts, default=None),
        sessions_last_7_days=_count_between(starts, now - _WEEK, now),
        sessions_previous_7_days=_count_between(starts, now - 2 * _WEEK, now - _WEEK),
        last_session_duration_minutes=_last_session_minutes(sessions),
    )


def _count_between(starts: list[datetime], since: datetime, until: datetime) -> int:
    return sum(since <= start < until for start in starts)


def _average_minutes(sessions: Sequence[CompletedSession]) -> float:
    if not sessions:
        return 0
    total_seconds = sum(session.duration_seconds or 0 for session in sessions)
    return round(total_seconds / len(sessions) / 60, 1)


def _last_session_minutes(sessions: Sequence[CompletedSession]) -> float:
    if not sessions:
        return 0
    last = max(sessions, key=lambda session: as_utc_aware(session.started_at))
    return round((last.duration_seconds or 0) / 60, 1)
