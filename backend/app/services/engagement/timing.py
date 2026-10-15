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
