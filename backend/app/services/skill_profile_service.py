"""A user's whole skill tree: time and level per branch and per focus, derived from sessions.

Branches earn the full time of sessions of their type, so history from before skill focuses
existed still counts; multi-area sessions split their time. Assigned minutes override that:
an area then only gets the assigned time of its focuses. Focuses earn only the share their
sessions allocate to them.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import ProductionSession, SessionType
from app.skill_catalog import SKILL_BRANCHES, SKILL_FOCUSES_BY_BRANCH, branch_of_focus
from app.services.skill_progress_service import (
    MIN_COUNTED_SESSION_SECONDS,
    SKILL_LEVEL_THRESHOLDS_SECONDS,
    SkillLevel,
    area_seconds_from_skill_time,
    counted_session_seconds,
    counted_skill_seconds,
    effective_area_weights,
    skill_level_for,
    split_by_area_weight,
)

# A branch collects every session of its type, so it needs a longer road than a single focus.
BRANCH_LEVEL_THRESHOLDS_SECONDS: tuple[int, ...] = tuple(
    hours * 3600 for hours in (0, 5, 15, 40, 100, 200, 400)
)


@dataclass(frozen=True)
class SkillNode:
    total_seconds: int
    level: SkillLevel
    session_count: int
    last_trained_at: datetime | None


@dataclass(frozen=True)
class SkillProfile:
    total_seconds: int
    branches: dict[str, SkillNode]
    focuses: dict[str, SkillNode]


@dataclass
class _Tally:
    seconds: int = 0
    session_count: int = 0
    last_trained_at: datetime | None = None

    def add(self, seconds: int, trained_at: datetime) -> None:
        self.seconds += seconds
        self.session_count += 1
        if self.last_trained_at is None or trained_at > self.last_trained_at:
            self.last_trained_at = trained_at


def branch_seconds_for_session(
    session_type: str,
    duration_seconds: int,
    focus_ids: list[str],
    weight_by_area: dict[str, int] | None = None,
) -> dict[str, int]:
    """Mix & master counts half for each side; learning counts for the areas it practiced;
    production splits by area weight."""
    duration_seconds = counted_session_seconds(duration_seconds)
    if not duration_seconds:
        return {}
    if session_type in SKILL_BRANCHES:
        return {session_type: duration_seconds}
    if session_type == SessionType.mix_and_master.value:
        half = round(duration_seconds / 2)
        return {SessionType.mixing.value: half, SessionType.mastering.value: half}
    if session_type == SessionType.production.value:
        return split_by_area_weight(
            duration_seconds, effective_area_weights(focus_ids, weight_by_area or {})
        )
    if session_type == SessionType.learning.value:
        practiced = list(dict.fromkeys(branch_of_focus(focus_id) for focus_id in focus_ids))
        if not practiced:
            return {}
        share = round(duration_seconds / len(practiced))
        return dict.fromkeys(practiced, share)
    return {}


def area_seconds_for_session(session: ProductionSession) -> dict[str, int]:
    """Assigned minutes when any were set; otherwise the legacy type/weight split."""
    if session.focus_times:
        return area_seconds_from_skill_time(counted_skill_seconds(session))
    return branch_seconds_for_session(
        session.session_type,
        session.duration_seconds or 0,
        session.skill_focus_ids,
        session.weight_by_area,
    )


def build_skill_profile(db: Session, user_id: int) -> SkillProfile:
    sessions = db.scalars(
        select(ProductionSession)
        .options(
            selectinload(ProductionSession.skill_focuses),
            selectinload(ProductionSession.area_weights),
        )
        .where(
            ProductionSession.user_id == user_id,
            ProductionSession.stopped_at.is_not(None),
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds >= MIN_COUNTED_SESSION_SECONDS,
        )
    ).all()

    branch_tallies = {branch: _Tally() for branch in SKILL_BRANCHES}
    focus_tallies = {
        f"{branch}.{focus}": _Tally()
        for branch, focuses in SKILL_FOCUSES_BY_BRANCH.items()
        for focus in focuses
    }
    total_seconds = 0
    for session in sessions:
        branch_seconds = area_seconds_for_session(session)
        if branch_seconds:
            total_seconds += counted_session_seconds(session.duration_seconds or 0)
        for branch, seconds in branch_seconds.items():
            branch_tallies[branch].add(seconds, session.started_at)
        for focus_id, seconds in counted_skill_seconds(session).items():
            if focus_id in focus_tallies:
                focus_tallies[focus_id].add(seconds, session.started_at)

    return SkillProfile(
        total_seconds=total_seconds,
        branches={
            branch: _node(tally, BRANCH_LEVEL_THRESHOLDS_SECONDS)
            for branch, tally in branch_tallies.items()
        },
        focuses={focus_id: _node(tally) for focus_id, tally in focus_tallies.items()},
    )


def _node(tally: _Tally, thresholds: tuple[int, ...] = SKILL_LEVEL_THRESHOLDS_SECONDS) -> SkillNode:
    return SkillNode(
        total_seconds=tally.seconds,
        level=skill_level_for(tally.seconds, thresholds),
        session_count=tally.session_count,
        last_trained_at=tally.last_trained_at,
    )
