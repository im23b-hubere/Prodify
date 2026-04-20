import json
import math

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models import UserProgression, XpLedger, utcnow
from app.schemas import ProgressionPublic

SESSION_XP_MINUTES_FLOOR = 5
BASE_SESSION_XP = 8
SESSION_XP_PER_MINUTE_AFTER_FLOOR = 0.8
SESSION_XP_MAX = 110
XP_DECAY_GRACE_DAYS = 2
XP_DECAY_PER_DAY = 12
XP_LEVEL_CATALOG_MAX = 20


def _level_for_xp(xp_total: int) -> int:
    return max(1, int(math.floor(1 + math.sqrt(max(0, xp_total) / 50))))


def _level_floor_xp(level: int) -> int:
    # Inverse of _level_for_xp: minimum XP that belongs to this level.
    return int(max(0, (max(1, level) - 1) ** 2 * 50))


def _next_level_target_xp(current_level: int) -> int:
    # XP required to reach the next level from the current level.
    return int((max(1, current_level) ** 2) * 50)


def _recompute_progression_fields(row: UserProgression) -> None:
    row.current_level = _level_for_xp(int(row.xp_total or 0))
    next_threshold = _next_level_target_xp(row.current_level)
    row.xp_to_next_level = max(0, next_threshold - int(row.xp_total or 0))


def _last_positive_xp_at(db: Session, user_id: int):
    return db.scalar(
        select(XpLedger.created_at)
        .where(XpLedger.user_id == user_id, XpLedger.xp_delta > 0)
        .order_by(desc(XpLedger.created_at))
        .limit(1)
    )


def apply_inactivity_decay(db: Session, user_id: int) -> tuple[UserProgression | None, bool]:
    row = db.scalar(select(UserProgression).where(UserProgression.user_id == user_id))
    if row is None:
        return None, False

    last_positive_at = _last_positive_xp_at(db, user_id)
    if last_positive_at is None:
        return row, False

    now = utcnow()
    days_since_activity = max(0, (now.date() - last_positive_at.date()).days)
    decay_days_due = max(0, days_since_activity - XP_DECAY_GRACE_DAYS)
    if decay_days_due <= 0:
        return row, False

    streak_marker = f"since:{last_positive_at.date().isoformat()}"
    already_applied = db.scalar(
        select(func.coalesce(func.sum(-XpLedger.xp_delta), 0)).where(
            XpLedger.user_id == user_id,
            XpLedger.source_type == "inactivity_decay",
            XpLedger.source_id == streak_marker,
            XpLedger.xp_delta < 0,
        )
    )
    decay_due_total = decay_days_due * XP_DECAY_PER_DAY
    decay_delta = max(0, int(decay_due_total) - int(already_applied or 0))
    if decay_delta <= 0:
        return row, False

    row.xp_total = max(0, int(row.xp_total or 0) - decay_delta)
    _recompute_progression_fields(row)
    row.updated_at = now
    db.add(
        XpLedger(
            user_id=user_id,
            source_type="inactivity_decay",
            source_id=streak_marker,
            xp_delta=-decay_delta,
            meta_json=json.dumps(
                {
                    "days_since_activity": days_since_activity,
                    "decay_days_due": decay_days_due,
                    "xp_decay_per_day": XP_DECAY_PER_DAY,
                }
            ),
        )
    )
    return row, True


def level_catalog(max_level: int = XP_LEVEL_CATALOG_MAX) -> list[dict[str, int | None]]:
    out: list[dict[str, int | None]] = []
    top = max(1, max_level)
    for level in range(1, top + 1):
        start_xp = _level_floor_xp(level)
        next_start = _level_floor_xp(level + 1)
        out.append(
            {
                "level": level,
                "xp_start": start_xp,
                "xp_end_exclusive": next_start,
                "xp_span": max(1, next_start - start_xp),
            }
        )
    return out


def xp_for_completed_session(duration_seconds: int) -> int:
    """Session XP based on meaningful duration with anti-tap exploitation."""
    minutes = max(0, int(duration_seconds // 60))
    # Avoid abuse from extremely short sessions (start/stop spam).
    if minutes < SESSION_XP_MINUTES_FLOOR:
        return 0
    scaled_minutes = minutes - SESSION_XP_MINUTES_FLOOR
    raw = BASE_SESSION_XP + int(scaled_minutes * SESSION_XP_PER_MINUTE_AFTER_FLOOR)
    return max(0, min(SESSION_XP_MAX, raw))


def grant_xp(
    db: Session,
    user_id: int,
    xp_delta: int,
    source_type: str,
    source_id: str | None = None,
    meta: dict | None = None,
) -> UserProgression:
    row = db.scalar(select(UserProgression).where(UserProgression.user_id == user_id))
    if row is None:
        row = UserProgression(user_id=user_id)
        db.add(row)
        db.flush()
    # Ensure inactivity decay cannot be bypassed by returning after a long break.
    if int(xp_delta) > 0:
        apply_inactivity_decay(db, user_id)
    row.xp_total = max(0, int(row.xp_total or 0) + int(xp_delta))
    _recompute_progression_fields(row)
    row.updated_at = utcnow()
    db.add(
        XpLedger(
            user_id=user_id,
            source_type=source_type,
            source_id=source_id,
            xp_delta=xp_delta,
            meta_json=json.dumps(meta or {}),
        )
    )
    return row


def to_progression_public(row: UserProgression | None) -> ProgressionPublic:
    if row is None:
        return ProgressionPublic(xp_total=0, current_level=1, xp_to_next_level=50, progress_percent=0.0)
    current_level_floor = _level_floor_xp(row.current_level)
    next_level_floor = _level_floor_xp(row.current_level + 1)
    progress_span = max(1, next_level_floor - current_level_floor)
    progress_in_level = max(0, row.xp_total - current_level_floor)
    progress_percent = round(min(100.0, (progress_in_level / progress_span) * 100), 1)
    return ProgressionPublic(
        xp_total=row.xp_total,
        current_level=row.current_level,
        xp_to_next_level=row.xp_to_next_level,
        progress_percent=progress_percent,
    )
