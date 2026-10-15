"""
When a producer usually produces, and so when a nudge has the best chance.

Everything is local wall-clock time in the producer's zone; UTC only appears when comparing
instants.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.services.engagement.profile import STAGE_COLD_START, STAGE_ESTABLISHED, BehaviorProfile
from app.timeutil import as_utc_aware, in_zone

ALL_WEEKDAYS = tuple(range(7))
WINDOW_HOURS = 3
STRONGEST_WEEKDAYS = 3
# Send a little before the window opens, so the producer can still plan the session.
NOTIFY_LEAD = timedelta(minutes=25)
# The engine job runs every 15-30 minutes; a send moment must be wide enough to be hit once.
SEND_SLOT = timedelta(minutes=30)
# About 15% of producer-days try a neighbouring hour instead of the learned one.
EXPLORATION_BUCKETS = 20
EXPLORATION_SLOTS = 3
_EXPLORATION_OFFSETS = (1, -1, 2)


@dataclass(frozen=True)
class ProductionWindow:
    """Local hours [start_hour, end_hour) on the given weekdays; may run past midnight."""

    weekdays: tuple[int, ...]
    start_hour: int
    end_hour: int
    is_default: bool = False


DEFAULT_WINDOW = ProductionWindow(weekdays=ALL_WEEKDAYS, start_hour=17, end_hour=21, is_default=True)


def production_window(profile: BehaviorProfile) -> ProductionWindow:
    """
    Cold-start producers get the default evening. Learning producers get their own hours on
    every day; established producers also narrow down to their strongest weekdays.
    """
    if profile.stage == STAGE_COLD_START or not any(profile.session_hour_histogram):
        return DEFAULT_WINDOW
    start_hour, length = _busiest_block(profile.session_hour_histogram)
    weekdays = _strongest_weekdays(profile.weekday_histogram) if profile.stage == STAGE_ESTABLISHED else ALL_WEEKDAYS
    return ProductionWindow(weekdays=weekdays, start_hour=start_hour, end_hour=(start_hour + length) % 24)


def send_time_on(window: ProductionWindow, window_day: date, zone: ZoneInfo) -> datetime:
    """The local moment to nudge for the window opening on `window_day`."""
    opens_at = datetime.combine(window_day, time(window.start_hour), tzinfo=zone)
    return opens_at - NOTIFY_LEAD


def is_send_moment(window: ProductionWindow, now: datetime, zone: ZoneInfo) -> bool:
    """Whether `now` falls in the send slot before one of the window's openings."""
    now_utc = as_utc_aware(now)
    local_today = in_zone(now, zone).date()
    for window_day in (local_today, local_today + timedelta(days=1)):
        if window_day.weekday() not in window.weekdays:
            continue
        send_at = as_utc_aware(send_time_on(window, window_day, zone))
        if send_at <= now_utc < send_at + SEND_SLOT:
            return True
    return False


def next_send_time(window: ProductionWindow, now: datetime, zone: ZoneInfo) -> datetime:
    """The first send moment that has not started yet."""
    now_utc = as_utc_aware(now)
    local_today = in_zone(now, zone).date()
    for days_ahead in range(8):
        window_day = local_today + timedelta(days=days_ahead)
        if window_day.weekday() not in window.weekdays:
            continue
        send_at = send_time_on(window, window_day, zone)
        if as_utc_aware(send_at) > now_utc:
            return send_at
    raise ValueError("a production window opens at least once a week")


def send_hour_for(preferred: int, user_id: int, local_day: date, window: ProductionWindow) -> int:
    """The learned hour, or a nearby hour inside the production window on an exploration day."""
    if (user_id + local_day.toordinal()) % EXPLORATION_BUCKETS >= EXPLORATION_SLOTS:
        return preferred
    for offset in _EXPLORATION_OFFSETS:
        hour = (preferred + offset) % 24
        if _hour_in_window(window, local_day.weekday(), hour):
            return hour
    return preferred


def _hour_in_window(window: ProductionWindow, weekday: int, hour: int) -> bool:
    if weekday not in window.weekdays:
        return False
    if window.start_hour <= window.end_hour:
        return window.start_hour <= hour < window.end_hour
    return hour >= window.start_hour or hour < window.end_hour


def is_learned_send_moment(hour: int, now: datetime, zone: ZoneInfo) -> bool:
    """Whether `now` is in the send slot at the start of the producer's learned local hour."""
    local = in_zone(now, zone)
    return local.hour == hour and timedelta(minutes=local.minute) < SEND_SLOT


def next_learned_send_time(hour: int, now: datetime, zone: ZoneInfo) -> datetime:
    local_today = in_zone(now, zone).date()
    for days_ahead in (0, 1):
        send_at = datetime.combine(local_today + timedelta(days=days_ahead), time(hour), tzinfo=zone)
        if as_utc_aware(send_at) > as_utc_aware(now):
            return send_at
    raise ValueError("a learned hour comes round every day")


def _busiest_block(hour_histogram: list[int]) -> tuple[int, int]:
    """Start and length of the busiest run of `WINDOW_HOURS` hours, trimmed of empty edge hours."""

    def block_total(start: int) -> int:
        return sum(hour_histogram[(start + offset) % 24] for offset in range(WINDOW_HOURS))

    start = max(range(24), key=lambda hour: (block_total(hour), -hour))
    length = WINDOW_HOURS
    while hour_histogram[start] == 0:
        start, length = (start + 1) % 24, length - 1
    while hour_histogram[(start + length - 1) % 24] == 0:
        length -= 1
    return start, length


def _strongest_weekdays(weekday_histogram: list[int]) -> tuple[int, ...]:
    active = [day for day in range(7) if weekday_histogram[day] > 0]
    strongest = sorted(active, key=lambda day: (-weekday_histogram[day], day))[:STRONGEST_WEEKDAYS]
    return tuple(sorted(strongest)) or ALL_WEEKDAYS
