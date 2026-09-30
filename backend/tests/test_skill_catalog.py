import json
import re
from pathlib import Path

from app.skill_catalog import (
    SKILL_BRANCHES,
    SKILL_FOCUS_IDS,
    SKILL_FOCUSES_BY_BRANCH,
    is_focus_allowed_for_session_type,
    skill_branches_for_session_type,
)

MOBILE_ROOT = Path(__file__).resolve().parents[2] / "mobile"


def _camel(slug: str) -> str:
    return re.sub(r"_([a-z])", lambda match: match.group(1).upper(), slug)


def test_every_branch_has_between_five_and_eight_focuses():
    assert set(SKILL_FOCUSES_BY_BRANCH) == set(SKILL_BRANCHES)
    for focuses in SKILL_FOCUSES_BY_BRANCH.values():
        assert 5 <= len(focuses) <= 8
        assert len(set(focuses)) == len(focuses)


def test_mix_and_master_sessions_pick_from_mixing_and_mastering():
    assert skill_branches_for_session_type("mix_and_master") == ("mixing", "mastering")


def test_learning_sessions_pick_from_every_branch():
    assert skill_branches_for_session_type("learning") == SKILL_BRANCHES


def test_unknown_session_type_has_no_branches():
    assert skill_branches_for_session_type("podcasting") == ()


def test_focus_is_only_allowed_for_matching_session_types():
    assert is_focus_allowed_for_session_type("mixing.eq", "mixing")
    assert is_focus_allowed_for_session_type("mixing.eq", "mix_and_master")
    assert is_focus_allowed_for_session_type("mixing.eq", "learning")
    assert not is_focus_allowed_for_session_type("mixing.eq", "beat_making")
    assert not is_focus_allowed_for_session_type("mixing.unknown", "mixing")


def test_catalog_matches_mobile_copy():
    locale = json.loads((MOBILE_ROOT / "locales" / "en.json").read_text(encoding="utf-8"))
    copy_ids = {
        f"{branch}.{focus}"
        for branch in SKILL_BRANCHES
        for focus in _snake_focus_keys(locale["skills"][_camel(branch)]["focuses"])
    }
    assert copy_ids == SKILL_FOCUS_IDS


def test_every_focus_has_complete_copy():
    locale = json.loads((MOBILE_ROOT / "locales" / "en.json").read_text(encoding="utf-8"))
    required_fields = {"label", "short", "description", "practice", "covers"}
    incomplete = [
        f"{branch}.{key}"
        for branch, entry in locale["skills"].items()
        for key, focus in entry["focuses"].items()
        if not required_fields.issubset(field for field, text in focus.items() if text.strip())
    ]
    assert incomplete == []


def test_catalog_matches_mobile_constants():
    source = (MOBILE_ROOT / "constants" / "skills.ts").read_text(encoding="utf-8")
    mobile_ids = set(re.findall(r'id: "([a-z_]+\.[a-z_]+)"', source))
    assert mobile_ids == SKILL_FOCUS_IDS


def _snake_focus_keys(focuses: dict) -> list[str]:
    return [re.sub(r"([A-Z])", lambda match: f"_{match.group(1).lower()}", key) for key in focuses]
