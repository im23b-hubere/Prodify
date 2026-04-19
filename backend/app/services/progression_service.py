import json
import math

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import UserProgression, XpLedger, utcnow
from app.schemas import ProgressionPublic


def _level_for_xp(xp_total: int) -> int:
    return max(1, int(math.floor(1 + math.sqrt(max(0, xp_total) / 50))))


def _next_level_threshold(level: int) -> int:
    return int(((level) ** 2) * 50)


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
    row.xp_total = max(0, int(row.xp_total or 0) + int(xp_delta))
    row.current_level = _level_for_xp(row.xp_total)
    next_threshold = _next_level_threshold(row.current_level + 1)
    row.xp_to_next_level = max(0, next_threshold - row.xp_total)
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
    current_level_floor = _next_level_threshold(row.current_level)
    next_level_floor = _next_level_threshold(row.current_level + 1)
    progress_span = max(1, next_level_floor - current_level_floor)
    progress_in_level = max(0, row.xp_total - current_level_floor)
    progress_percent = round(min(100.0, (progress_in_level / progress_span) * 100), 1)
    return ProgressionPublic(
        xp_total=row.xp_total,
        current_level=row.current_level,
        xp_to_next_level=row.xp_to_next_level,
        progress_percent=progress_percent,
    )
