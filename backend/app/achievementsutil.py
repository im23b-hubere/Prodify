from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ProductionSession, UserAchievement, utcnow
from app.streakutil import compute_current_streak, parse_frozen_json
from app.timeutil import as_utc_aware

ACHIEVEMENT_DEFINITIONS: list[tuple[str, str, str, str]] = [
    ("first_session", "First session", "You started your Prodify journey.", "🎹"),
    ("sessions_10", "10 sessions", "Ten focused sessions in the books.", "🔥"),
    ("sessions_50", "50 sessions", "Fifty sessions — consistency wins.", "💪"),
    ("streak_7", "Week streak", "Seven days in a row.", "⚡"),
    ("marathon_2h", "Marathon producer", "A single session over 2 hours.", "👑"),
    ("night_owl", "Night owl", "10+ sessions starting after 10 PM.", "🦉"),
]


def _has_achievement(db: Session, user_id: int, achievement_type: str) -> bool:
    row = db.scalar(
        select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_type == achievement_type,
        )
    )
    return row is not None


def _grant(db: Session, user_id: int, achievement_type: str) -> bool:
    if _has_achievement(db, user_id, achievement_type):
        return False
    db.add(
        UserAchievement(
            user_id=user_id,
            achievement_type=achievement_type,
            unlocked_at=utcnow(),
        )
    )
    return True


def grant_achievements_after_completed_session(
    db: Session,
    user_id: int,
    completed: ProductionSession,
    streak_row,
) -> list[str]:
    """Return list of newly unlocked achievement ids."""
    new_ids: list[str] = []

    all_completed = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()
    n = len(all_completed)

    if n == 1 and _grant(db, user_id, "first_session"):
        new_ids.append("first_session")
    if n >= 10 and _grant(db, user_id, "sessions_10"):
        new_ids.append("sessions_10")
    if n >= 50 and _grant(db, user_id, "sessions_50"):
        new_ids.append("sessions_50")

    session_days = [as_utc_aware(r.started_at).date().isoformat() for r in all_completed]
    frozen: list[str] = []
    if streak_row is not None:
        frozen = parse_frozen_json(streak_row.frozen_day_keys)
    merged = list(set(session_days) | set(frozen))
    cur = compute_current_streak(merged)
    if cur >= 7 and _grant(db, user_id, "streak_7"):
        new_ids.append("streak_7")

    dur = completed.duration_seconds or 0
    if dur >= 7200 and _grant(db, user_id, "marathon_2h"):
        new_ids.append("marathon_2h")

    night_starts = sum(1 for r in all_completed if as_utc_aware(r.started_at).hour >= 22)
    if night_starts >= 10 and _grant(db, user_id, "night_owl"):
        new_ids.append("night_owl")

    return new_ids


def calculate_focus_score(
    duration_minutes: float,
    paused_duration_minutes: float,
    notes_length: int,
    mood_level: int | None,
    pause_count: int = 0,
    background_switches: int = 0,
    time_of_day: int | None = None,
) -> int:
    """Heuristic focus score 0–100 with stronger variance."""
    if duration_minutes <= 0 and paused_duration_minutes <= 0:
        return 0
    mood = mood_level if mood_level is not None else 3
    score = sum(
        (
            100,
            _pause_ratio_adjustment(duration_minutes, paused_duration_minutes),
            _threshold_adjustment(pause_count, ((5, -15), (3, -8), (1, -3))),
            _threshold_adjustment(background_switches, ((10, -20), (5, -10), (2, -5))),
            _duration_adjustment(duration_minutes),
            _notes_adjustment(notes_length),
            2 if mood >= 4 else 0,
            -2 if time_of_day is not None and 1 <= time_of_day <= 5 else 0,
        )
    )
    return max(0, min(100, int(round(score))))


def _pause_ratio_adjustment(duration_minutes: float, paused_minutes: float) -> int:
    if paused_minutes <= 0:
        return 0
    if duration_minutes <= 0:
        return -5
    ratio = paused_minutes / duration_minutes
    return _threshold_adjustment(ratio, ((0.4, -35), (0.25, -20), (0.15, -10), (0.05, -5)))


def _threshold_adjustment(
    value: float,
    thresholds: tuple[tuple[float, int], ...],
) -> int:
    return next((adjustment for threshold, adjustment in thresholds if value > threshold), 0)


def _duration_adjustment(duration_minutes: float) -> int:
    if duration_minutes < 15:
        return -10
    if duration_minutes < 30:
        return -5
    return 5 if duration_minutes >= 90 else 0


def _notes_adjustment(notes_length: int) -> int:
    if notes_length > 100:
        return 3
    return -2 if notes_length == 0 else 0


def compute_focus_score_for_session(row: ProductionSession) -> int:
    dur_s = int(row.duration_seconds or 0)
    paused_s = int(row.paused_duration_seconds or 0)
    dur_m = dur_s / 60.0
    paused_m = paused_s / 60.0
    notes_len = len(row.notes or "")
    pause_count = 1 if paused_s > 0 else 0
    tod = as_utc_aware(row.started_at).hour if row.started_at is not None else None
    return calculate_focus_score(
        dur_m,
        paused_m,
        notes_len,
        row.mood_level,
        pause_count=pause_count,
        background_switches=0,
        time_of_day=tod,
    )


def session_focus_metrics(session: ProductionSession) -> tuple[int, float]:
    """Focus score 0–100 and effective active-time rate percent."""
    dur = int(session.duration_seconds or 0)
    paused = int(session.paused_duration_seconds or 0)
    gross = dur + max(0, paused)
    if gross <= 0:
        return 0, 100.0
    rate_pct = round(dur / gross * 100, 1)

    if session.focus_score is not None:
        return int(session.focus_score), rate_pct

    return compute_focus_score_for_session(session), rate_pct
