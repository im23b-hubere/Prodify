"""Canonical skill catalog.

Level 1 branches reuse session type slugs; level 2 focuses are ``branch.focus`` slugs.
Must stay in sync with mobile/constants/skills.ts (copy lives in mobile/locales/en.json).
"""

from app.models import SessionType

SKILL_BRANCHES: tuple[str, ...] = (
    SessionType.beat_making.value,
    SessionType.mixing.value,
    SessionType.mastering.value,
    SessionType.sound_design.value,
    SessionType.recording.value,
    SessionType.songwriting.value,
    SessionType.arrangement.value,
    SessionType.vocal_production.value,
)

# Tuple order is the curated display order within each branch.
SKILL_FOCUSES_BY_BRANCH: dict[str, tuple[str, ...]] = {
    "beat_making": ("drums", "groove", "bass", "chords_melody", "sampling", "sound_selection"),
    "mixing": (
        "balance",
        "eq",
        "dynamics",
        "saturation",
        "space",
        "stereo",
        "automation",
        "translation",
    ),
    "mastering": ("tonal_balance", "dynamics", "loudness", "stereo", "references", "delivery"),
    "sound_design": ("synthesis", "advanced_synthesis", "modulation", "sampling", "effects", "layering"),
    "recording": ("mic_technique", "vocals", "gain_staging", "room", "tracking", "instruments"),
    "songwriting": ("melody", "harmony", "lyrics", "song_form", "hooks"),
    "arrangement": ("structure", "transitions", "energy", "variation", "instrumentation"),
    "vocal_production": ("comping", "tuning", "chain", "fx", "layering"),
}

SKILL_FOCUS_IDS: frozenset[str] = frozenset(
    f"{branch}.{focus}" for branch, focuses in SKILL_FOCUSES_BY_BRANCH.items() for focus in focuses
)

# Planning is an intention, so it stays small; reflecting afterwards may list everything touched.
MAX_PLANNED_FOCUSES_PER_SESSION = 2

# How much of a production session went into an area: a little, some or a lot.
AREA_WEIGHTS: tuple[int, ...] = (1, 2, 3)
DEFAULT_AREA_WEIGHT = 2

MULTI_AREA_SESSION_TYPES: frozenset[str] = frozenset(
    {SessionType.learning.value, SessionType.production.value}
)


def skill_branches_for_session_type(session_type: str) -> tuple[str, ...]:
    """Branches whose focuses a session of this type can pick from."""
    if session_type == SessionType.mix_and_master.value:
        return (SessionType.mixing.value, SessionType.mastering.value)
    if session_type in MULTI_AREA_SESSION_TYPES:
        return SKILL_BRANCHES
    if session_type in SKILL_BRANCHES:
        return (session_type,)
    return ()


def branch_of_focus(focus_id: str) -> str:
    return focus_id.split(".", 1)[0]


def is_focus_allowed_for_session_type(focus_id: str, session_type: str) -> bool:
    if focus_id not in SKILL_FOCUS_IDS:
        return False
    return branch_of_focus(focus_id) in skill_branches_for_session_type(session_type)


def normalize_focus_ids(values: object, max_count: int | None = None) -> list[str]:
    """Deduplicate (keeping order) and validate client-sent focus ids against the catalog."""
    if not isinstance(values, list):
        raise ValueError("skill_focus_ids must be a list of strings")
    normalized = list(dict.fromkeys(str(value).strip() for value in values))
    unknown = [focus_id for focus_id in normalized if focus_id not in SKILL_FOCUS_IDS]
    if unknown:
        raise ValueError(f"unknown skill focus ids: {', '.join(unknown)}")
    if max_count is not None and len(normalized) > max_count:
        raise ValueError(f"at most {max_count} skill focuses allowed")
    return normalized


def incompatible_focus_ids(focus_ids: list[str], session_type: str) -> list[str]:
    return [
        focus_id
        for focus_id in focus_ids
        if not is_focus_allowed_for_session_type(focus_id, session_type)
    ]
