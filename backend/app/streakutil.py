"""Streak calculations — session days merged with streak freeze (rest) days."""

from __future__ import annotations

import json
from datetime import date, timedelta

from app.models import utcnow


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


def compute_current_streak(day_iso_strings: list[str]) -> int:
    """Consecutive calendar days ending today or yesterday (UTC), same rules as sessions router."""
    if not day_iso_strings:
        return 0
    dates = {date.fromisoformat(s) for s in day_iso_strings}
    today = utcnow().date()
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


def last_7_day_states(session_days: list[str], frozen_days: list[str]) -> tuple[list[str], list[str]]:
    """
    Returns parallel arrays length 7: oldest → newest (index 0 = 6 days ago, 6 = today).
    state is 'session' | 'freeze' | 'none'
    label is weekday letter M–S for that column.
    """
    letters = ["M", "T", "W", "T", "F", "S", "S"]
    today = utcnow().date()
    sess = set(session_days)
    frz = set(frozen_days)
    states: list[str] = []
    labels: list[str] = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        dk = d.isoformat()
        labels.append(letters[d.weekday()])
        if dk in sess:
            states.append("session")
        elif dk in frz:
            states.append("freeze")
        else:
            states.append("none")
    return states, labels
