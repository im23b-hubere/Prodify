from app.services.skill_profile_service import branch_seconds_for_session
from tests.auth_helpers import auth_headers as _auth_headers
from tests.test_session_skill_focuses import _finished_session, _progress_by_skill, _reflect

HOUR = 3600


def _profile(client, headers) -> dict:
    response = client.get("/skills/profile", headers=headers)
    assert response.status_code == 200
    return response.json()


def _branch(profile: dict, branch: str) -> dict:
    return next(item for item in profile["branches"] if item["branch"] == branch)


def _focus(profile: dict, skill_id: str) -> dict:
    return next(item for item in profile["focuses"] if item["skill_id"] == skill_id)


def test_branch_seconds_count_the_whole_session_for_its_type():
    assert branch_seconds_for_session("mixing", 3600, []) == {"mixing": 3600}


def test_branch_seconds_split_mix_and_master_evenly():
    assert branch_seconds_for_session("mix_and_master", 3600, []) == {
        "mixing": 1800,
        "mastering": 1800,
    }


def test_branch_seconds_credit_learning_to_the_practiced_area_only():
    assert branch_seconds_for_session("learning", 3600, ["mixing.eq", "mixing.dynamics"]) == {
        "mixing": 3600
    }
    assert branch_seconds_for_session("learning", 3600, []) == {}


def test_branch_seconds_ignore_short_sessions():
    assert branch_seconds_for_session("mixing", 120, []) == {}


def test_branch_seconds_cap_a_forgotten_timer():
    assert branch_seconds_for_session("mixing", 30 * HOUR, []) == {"mixing": 12 * HOUR}


def test_new_user_gets_the_full_tree_with_nothing_trained(client):
    headers = _auth_headers(client, "tree-empty@example.com", "tree-empty")

    profile = _profile(client, headers)

    assert profile["total_seconds"] == 0
    assert len(profile["branches"]) == 8
    assert len(profile["focuses"]) == 47
    assert all(item["total_seconds"] == 0 and item["level"] == 1 for item in profile["branches"])
    assert all(item["last_trained_at"] is None for item in profile["focuses"])


def test_sessions_without_focuses_still_grow_their_branch(client):
    headers = _auth_headers(client, "tree-history@example.com", "tree-history")
    _finished_session(client, headers, duration_minutes=6 * 60, session_type="mixing")

    mixing = _branch(_profile(client, headers), "mixing")

    assert mixing["total_seconds"] == 6 * HOUR
    assert mixing["level"] == 2
    assert mixing["next_level_seconds"] == 15 * HOUR
    assert mixing["session_count"] == 1
    assert mixing["last_trained_at"] is not None


def test_focus_totals_match_the_session_progress(client):
    headers = _auth_headers(client, "tree-focus@example.com", "tree-focus")
    session_id = _finished_session(client, headers, duration_minutes=120, session_type="mixing")
    _reflect(client, headers, session_id, ["mixing.eq", "mixing.dynamics"], "mixing.eq")

    profile = _profile(client, headers)
    session_progress = _progress_by_skill(client, headers, session_id)

    for skill_id in ("mixing.eq", "mixing.dynamics"):
        assert _focus(profile, skill_id)["total_seconds"] == session_progress[skill_id]["total_seconds"]
        assert _focus(profile, skill_id)["level"] == session_progress[skill_id]["level"]
    assert _focus(profile, "mixing.saturation")["total_seconds"] == 0


def test_deleted_and_short_sessions_do_not_count(client):
    headers = _auth_headers(client, "tree-excluded@example.com", "tree-excluded")
    deleted_id = _finished_session(client, headers, duration_minutes=60, session_type="mastering")
    client.delete(f"/sessions/item/{deleted_id}", headers=headers)
    _finished_session(client, headers, duration_minutes=3, session_type="mastering")

    assert _branch(_profile(client, headers), "mastering")["total_seconds"] == 0


def test_profile_only_contains_the_callers_sessions(client):
    owner = _auth_headers(client, "tree-owner@example.com", "tree-owner")
    stranger = _auth_headers(client, "tree-stranger@example.com", "tree-stranger")
    _finished_session(client, owner, duration_minutes=60, session_type="recording")

    assert _profile(client, stranger)["total_seconds"] == 0
