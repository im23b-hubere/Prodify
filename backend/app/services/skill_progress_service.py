"""Skill time earned from sessions and the level each skill has reached.

Totals are always derived from the stored sessions, so editing or deleting a session can never
leave a stale counter behind.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ProductionSession, SessionSkillFocus
from app.services.progression_service import SESSION_XP_MINUTES_FLOOR

MIN_COUNTED_SESSION_SECONDS = SESSION_XP_MINUTES_FLOOR * 60
# A timer left running overnight must not push a skill several levels at once.
MAX_COUNTED_SESSION_SECONDS = 12 * 3600
PRIMARY_FOCUS_SHARE = 0.5
# Early levels come quickly so progress is felt; later ones take real practice.
SKILL_LEVEL_THRESHOLDS_SECONDS: tuple[int, ...] = tuple(
    hours * 3600 for hours in (0, 1, 3, 6, 10, 20, 40)
)


@dataclass(frozen=True)
class SkillLevel:
    level: int
    level_start_seconds: int
    next_level_seconds: int | None


@dataclass(frozen=True)
class SkillProgress:
    skill_id: str
    gained_seconds: int
    total_seconds: int
    level: int
    previous_level: int
    level_start_seconds: int
    next_level_seconds: int | None


def counted_session_seconds(duration_seconds: int) -> int:
    """Skill time a session can earn: nothing when too short, capped when implausibly long."""
    if duration_seconds < MIN_COUNTED_SESSION_SECONDS:
        return 0
    return min(duration_seconds, MAX_COUNTED_SESSION_SECONDS)


def allocate_session_seconds(
    duration_seconds: int,
    focus_ids: list[str],
    primary_focus_id: str | None,
) -> dict[str, int]:
    """Split a session's time across its focuses; the main focus earns half when shared."""
    duration_seconds = counted_session_seconds(duration_seconds)
    if not focus_ids or not duration_seconds:
        return {}
    secondary_ids = [focus_id for focus_id in focus_ids if focus_id != primary_focus_id]
    if primary_focus_id not in focus_ids or not secondary_ids:
        even_share = round(duration_seconds / len(focus_ids))
        return dict.fromkeys(focus_ids, even_share)
    primary_seconds = round(duration_seconds * PRIMARY_FOCUS_SHARE)
    secondary_share = round((duration_seconds - primary_seconds) / len(secondary_ids))
    return {primary_focus_id: primary_seconds, **dict.fromkeys(secondary_ids, secondary_share)}


def skill_level_for(
    total_seconds: int,
    thresholds: tuple[int, ...] = SKILL_LEVEL_THRESHOLDS_SECONDS,
) -> SkillLevel:
    index = max(i for i, threshold in enumerate(thresholds) if total_seconds >= threshold)
    next_index = index + 1
    return SkillLevel(
        level=index + 1,
        level_start_seconds=thresholds[index],
        next_level_seconds=thresholds[next_index] if next_index < len(thresholds) else None,
    )


def counted_skill_seconds(session: ProductionSession) -> dict[str, int]:
    """What a session contributes to each of its focuses; nothing unless finished and kept."""
    return _counted_allocation(session)


def session_skill_progress(db: Session, session: ProductionSession) -> list[SkillProgress]:
    """Progress of every focus of this session, including what this session contributed."""
    skill_ids = session.skill_focus_ids
    if not skill_ids:
        return []
    gained = _counted_allocation(session)
    totals = _skill_totals(db, session.user_id, skill_ids)
    progress: list[SkillProgress] = []
    for skill_id in skill_ids:
        gained_seconds = gained.get(skill_id, 0)
        total_seconds = totals[skill_id]
        level = skill_level_for(total_seconds)
        progress.append(
            SkillProgress(
                skill_id=skill_id,
                gained_seconds=gained_seconds,
                total_seconds=total_seconds,
                level=level.level,
                previous_level=skill_level_for(total_seconds - gained_seconds).level,
                level_start_seconds=level.level_start_seconds,
                next_level_seconds=level.next_level_seconds,
            )
        )
    return progress


def _counted_allocation(session: ProductionSession) -> dict[str, int]:
    if session.stopped_at is None or session.deleted_at is not None:
        return {}
    return allocate_session_seconds(
        session.duration_seconds or 0,
        session.skill_focus_ids,
        session.primary_skill_focus_id,
    )


def _skill_totals(db: Session, user_id: int, skill_ids: list[str]) -> dict[str, int]:
    sessions_with_skills = select(SessionSkillFocus.session_id).where(
        SessionSkillFocus.skill_id.in_(skill_ids)
    )
    sessions = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.stopped_at.is_not(None),
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds >= MIN_COUNTED_SESSION_SECONDS,
            ProductionSession.id.in_(sessions_with_skills),
        )
    ).all()
    totals = dict.fromkeys(skill_ids, 0)
    for counted_session in sessions:
        for skill_id, seconds in _counted_allocation(counted_session).items():
            if skill_id in totals:
                totals[skill_id] += seconds
    return totals
