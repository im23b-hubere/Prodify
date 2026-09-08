"""UTC normalization plus per-user calendar-day resolution.

Streaks are a calendar-day concept, so "which day did this session belong to?" must be
answered in the user's own timezone. Everything is stored in UTC; only the day boundary
is localized.
"""

from datetime import date, datetime, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError, available_timezones

DEFAULT_TIMEZONE = "UTC"

MAX_TIMEZONE_LENGTH = 64


def as_utc_aware(dt: datetime) -> datetime:
    """SQLite often returns naive datetimes; normalize to UTC-aware for arithmetic."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@lru_cache(maxsize=1)
def _known_timezone_names() -> frozenset[str]:
    return frozenset(available_timezones())


def is_supported_timezone(name: str) -> bool:
    """True for IANA identifiers the running tz database actually knows (e.g. `Europe/Berlin`)."""
    return name in _known_timezone_names()


@lru_cache(maxsize=512)
def resolve_timezone(name: str | None) -> ZoneInfo:
    """
    Never raises: users without a stored timezone, and rows holding an identifier this
    tz database no longer ships, both fall back to UTC rather than breaking their streak.
    """
    if not name:
        return ZoneInfo(DEFAULT_TIMEZONE)
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(DEFAULT_TIMEZONE)


def in_zone(dt: datetime, zone: ZoneInfo) -> datetime:
    """The same instant expressed as the user's wall clock."""
    return as_utc_aware(dt).astimezone(zone)


def today_in(zone: ZoneInfo) -> date:
    return in_zone(datetime.now(timezone.utc), zone).date()
