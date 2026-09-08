"""Streak calculations — session days merged with streak freeze (rest) days."""

from __future__ import annotations

import json
from datetime import date, timedelta


def parse_frozen_json(raw: str | None) -> list[str]:
    if not raw or raw.strip() in ("", "[]"):
        return []
    try:
        data = json.loads(raw)
        if not isinstance(data, list):
            return []
        return [str(x) for x in data if x]
    except (json.JSONDecodeError, TypeError):
        return []


def dump_frozen_json(keys: list[str]) -> str:
    uniq = sorted({k for k in keys if k})
    return json.dumps(uniq)


def compute_current_streak(day_iso_strings: list[str], today: date) -> int:
    """
    Consecutive calendar days ending today or yesterday.

    `today` is required rather than derived here: the caller owns the timezone, and a
    silent UTC default would quietly shift day boundaries for users east or west of it.
    """
    if not day_iso_strings:
        return 0
    dates = {date.fromisoformat(s) for s in day_iso_strings}
    yesterday = today - timedelta(days=1)
    if today in dates:
        cursor = today
    elif yesterday in dates:
        cursor = yesterday
    else:
        return 0
    streak = 0
    while cursor in dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def best_streak_run(day_iso_strings: list[str]) -> int:
    """Longest run of consecutive calendar days in the set."""
    if not day_iso_strings:
        return 0
    days = sorted({date.fromisoformat(s) for s in day_iso_strings})
    if not days:
        return 0
    best = 1
    run = 1
    for i in range(1, len(days)):
        if (days[i] - days[i - 1]).days == 1:
            run += 1
            best = max(best, run)
        else:
            run = 1
    return best


def compute_streak_runs(day_iso_strings: list[str]) -> list[tuple[str, str, int]]:
    """
    Split unique calendar days into maximal consecutive runs.
    Returns list of (start_iso, end_iso, length_days), sorted by end date descending (newest first).
    """
    if not day_iso_strings:
        return []
    days = sorted({date.fromisoformat(s) for s in day_iso_strings})
    if not days:
        return []
    runs: list[tuple[date, date, int]] = []
    start = days[0]
    prev = days[0]
    for d in days[1:]:
        if (d - prev).days == 1:
            prev = d
        else:
            runs.append((start, prev, (prev - start).days + 1))
            start = d
            prev = d
    runs.append((start, prev, (prev - start).days + 1))
    runs.sort(key=lambda x: x[1], reverse=True)
    return [(s.isoformat(), e.isoformat(), n) for s, e, n in runs]


def last_7_day_states(
    session_days: list[str],
    frozen_days: list[str],
    *,
    today: date,
) -> tuple[list[str], list[str]]:
    """Current Monday–Sunday calendar week (index 0 = Monday)."""
    weeks = build_calendar_weeks(session_days, frozen_days, today=today, week_count=1)
    current = weeks[-1]["days"]
    return [day["state"] for day in current], [day["label"] for day in current]


CALENDAR_WEEK_COUNT = 4
_WEEKDAY_LETTERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]


def monday_of(day: date) -> date:
    return day - timedelta(days=day.weekday())


def build_calendar_weeks(
    session_days: list[str],
    frozen_days: list[str],
    *,
    today: date,
    week_count: int = CALENDAR_WEEK_COUNT,
) -> list[dict]:
    """
    Monday–Sunday weeks, oldest first.
    offset 0 is the current week; -1 is last week.
    """
    this_monday = monday_of(today)
    sess = set(session_days)
    frz = set(frozen_days)
    count = max(1, week_count)
    weeks: list[dict] = []
    for back in range(count - 1, -1, -1):
        start = this_monday - timedelta(days=7 * back)
        days = []
        for index in range(7):
            day = start + timedelta(days=index)
            key = day.isoformat()
            if key in sess:
                state = "session"
            elif key in frz:
                state = "freeze"
            else:
                state = "none"
            days.append(
                {
                    "date": key,
                    "label": _WEEKDAY_LETTERS[day.weekday()],
                    "state": state,
                    "is_today": day == today,
                    "is_future": day > today,
                }
            )
        weeks.append(
            {
                "week_start": start.isoformat(),
                "offset": -back,
                "days": days,
            }
        )
    return weeks
