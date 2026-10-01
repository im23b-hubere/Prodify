"""Keep a session's skill focuses and area weights in sync with the catalog and its session type."""

from app.models import (
    ProductionSession,
    SessionAreaWeight,
    SessionSkillFocus,
    SessionType,
    SkillFocusSource,
)
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
