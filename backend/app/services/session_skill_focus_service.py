"""Keep a session's skill focuses and area weights in sync with the catalog and its session type."""

from app.models import (
    ProductionSession,
    SessionAreaWeight,
    SessionSkillFocus,
    SessionType,
    SkillFocusSource,
)
from app.services.skill_progress_service import counted_session_seconds, main_focus_id
from app.skill_catalog import (
    MAX_PLANNED_FOCUSES_PER_SESSION,
    incompatible_focus_ids,
    is_focus_allowed_for_session_type,
)


class SkillFocusValidationError(ValueError):
    pass


class IncompatibleSkillFocusError(SkillFocusValidationError):
    def __init__(self, focus_ids: list[str], session_type: str) -> None:
        super().__init__(
            f"skill focuses {', '.join(focus_ids)} do not belong to session type {session_type}"
        )


class TooManyPlannedFocusesError(SkillFocusValidationError):
    def __init__(self) -> None:
        super().__init__(
            f"at most {MAX_PLANNED_FOCUSES_PER_SESSION} skill focuses while a session is running"
        )


class PrimaryFocusNotSelectedError(SkillFocusValidationError):
    def __init__(self, focus_id: str) -> None:
        super().__init__(f"main focus {focus_id} must be one of the session's focuses")


class AreaWeightsRequireProductionError(SkillFocusValidationError):
    def __init__(self, session_type: str) -> None:
        super().__init__(f"area weights only apply to production sessions, not {session_type}")


class AssignedTimeNotSelectedError(SkillFocusValidationError):
    def __init__(self, focus_ids: list[str]) -> None:
        super().__init__(
            f"assigned time {', '.join(focus_ids)} must be one of the session's focuses"
        )


class AssignedTimeOverflowError(SkillFocusValidationError):
    def __init__(self) -> None:
        super().__init__("assigned time cannot exceed the session's duration")


class AssignedTimeRequiresStoppedSessionError(SkillFocusValidationError):
    def __init__(self) -> None:
        super().__init__("assigned time can only be set after the session is stopped")


class AssignedTimeOnShortSessionError(SkillFocusValidationError):
    def __init__(self) -> None:
        super().__init__("short sessions cannot take assigned time")


def replace_skill_focuses(
    session: ProductionSession,
    focus_ids: list[str],
    primary_focus_id: str | None = None,
) -> None:
    """Set the session's focuses, keeping rows (and their source) for ids that stay."""
    mismatched = incompatible_focus_ids(focus_ids, session.session_type)
    if mismatched:
        raise IncompatibleSkillFocusError(mismatched, session.session_type)
    if session.stopped_at is None and len(focus_ids) > MAX_PLANNED_FOCUSES_PER_SESSION:
        raise TooManyPlannedFocusesError
    kept = {focus.skill_id: focus for focus in session.skill_focuses if focus.skill_id in focus_ids}
    source = _source_for(session)
    session.skill_focuses = [
        kept.get(focus_id) or SessionSkillFocus(skill_id=focus_id, source=source)
        for focus_id in focus_ids
    ]
    set_primary_skill_focus(session, primary_focus_id)


def set_primary_skill_focus(session: ProductionSession, primary_focus_id: str | None) -> None:
    if primary_focus_id is not None and primary_focus_id not in session.skill_focus_ids:
        raise PrimaryFocusNotSelectedError(primary_focus_id)
    for focus in session.skill_focuses:
        focus.is_primary = focus.skill_id == primary_focus_id


def drop_incompatible_skill_focuses(session: ProductionSession) -> None:
    """After a session type change, silently remove focuses from other branches."""
    session.skill_focuses = [
        focus
        for focus in session.skill_focuses
        if is_focus_allowed_for_session_type(focus.skill_id, session.session_type)
    ]


def replace_area_weights(session: ProductionSession, weight_by_area: dict[str, int]) -> None:
    if weight_by_area and not _is_production(session):
        raise AreaWeightsRequireProductionError(session.session_type)
    kept = {row.branch: row for row in session.area_weights if row.branch in weight_by_area}
    session.area_weights = [
        _weighted_row(kept.get(branch), branch, weight) for branch, weight in weight_by_area.items()
    ]


def drop_area_weights_unless_production(session: ProductionSession) -> None:
    if not _is_production(session):
        session.area_weights = []


def replace_focus_times(
    session: ProductionSession, focus_times: list[dict[str, str | int | None]]
) -> None:
    """Replace assigned seconds on the current tap set. Missing ids become unset."""
    if session.stopped_at is None or session.duration_seconds is None:
        raise AssignedTimeRequiresStoppedSessionError
    by_id = {str(item["skill_id"]): item.get("assigned_seconds") for item in focus_times}
    unknown = [skill_id for skill_id in by_id if skill_id not in session.skill_focus_ids]
    if unknown:
        raise AssignedTimeNotSelectedError(unknown)
    counted = counted_session_seconds(session.duration_seconds)
    used = sum(int(value) for value in by_id.values() if value is not None)
    if counted == 0 and used > 0:
        raise AssignedTimeOnShortSessionError
    if used > counted:
        raise AssignedTimeOverflowError
    for focus in session.skill_focuses:
        value = by_id.get(focus.skill_id)
        focus.assigned_seconds = None if value is None else int(value)
    assigned = {
        focus.skill_id: focus.assigned_seconds or 0
        for focus in session.skill_focuses
        if focus.assigned_seconds is not None
    }
    if assigned:
        set_primary_skill_focus(session, main_focus_id(assigned))


def _weighted_row(row: SessionAreaWeight | None, branch: str, weight: int) -> SessionAreaWeight:
    if row is None:
        return SessionAreaWeight(branch=branch, weight=weight)
    row.weight = weight
    return row


def _is_production(session: ProductionSession) -> bool:
    return session.session_type == SessionType.production.value


def _source_for(session: ProductionSession) -> str:
    if session.stopped_at is None:
        return SkillFocusSource.planned.value
    return SkillFocusSource.reflected.value
