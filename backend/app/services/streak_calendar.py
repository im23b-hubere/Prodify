"""Per-user calendar-day resolution for streaks.

A streak is a chain of *local* days. Every consumer — reconciliation, achievements,
stats, reminders — must agree on where a day starts, so they all resolve their day keys
through one `StreakCalendar` loaded from the user's stored IANA timezone.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ProductionSession, User
from app.streakutil import monday_of
from app.timeutil import in_zone, resolve_timezone, today_in


@dataclass(frozen=True)
class StreakCalendar:
    """Maps UTC timestamps onto the calendar days a single user actually lived through."""

    zone: ZoneInfo

    @property
    def today(self) -> date:
        return today_in(self.zone)

    @property
    def today_key(self) -> str:
        return self.today.isoformat()

    @property
    def month_key(self) -> str:
        """`YYYY-MM` locally, so monthly allowances roll over at the user's midnight."""
        return self.today.strftime("%Y-%m")

    @property
    def week_start_key(self) -> str:
        """Monday of the user's current local week."""
        return monday_of(self.today).isoformat()

    @property
    def day_start_utc(self) -> datetime:
        """The instant the user's current day began, in UTC — for indexed timestamp filters."""
        return datetime.combine(self.today, time.min, tzinfo=self.zone).astimezone(timezone.utc)

    def local_time_of(self, moment: datetime) -> datetime:
        return in_zone(moment, self.zone)

    def day_key_of(self, moment: datetime) -> str:
        return self.local_time_of(moment).date().isoformat()

    def week_start_key_of(self, moment: datetime) -> str:
        return monday_of(self.local_time_of(moment).date()).isoformat()


UTC_CALENDAR = StreakCalendar(resolve_timezone(None))


def calendar_for(user: User | None) -> StreakCalendar:
    """Users without a reported timezone keep UTC day boundaries."""
    if user is None:
        return UTC_CALENDAR
    return StreakCalendar(resolve_timezone(user.timezone))


def load_calendar(db: Session, user_id: int) -> StreakCalendar:
    return calendar_for(db.get(User, user_id))


def session_day_keys(db: Session, user_id: int, calendar: StreakCalendar) -> list[str]:
    """Local day keys of every completed, non-deleted session belonging to the user."""
    started_at_values = db.scalars(
        select(ProductionSession.started_at).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()
    return [calendar.day_key_of(value) for value in started_at_values]
