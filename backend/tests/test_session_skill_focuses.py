import json

from sqlalchemy import select

from app.database import SessionLocal
from app.models import GrowthEvent, ProductionSession, SessionSkillFocus
from tests.auth_helpers import auth_headers as _auth_headers


def _start(client, headers, **body):
    return client.post("/sessions/start", headers=headers, json=body)


def _finished_session(client, headers, *, duration_minutes: int, **body) -> int:
    session_id = _start(client, headers, **body).json()["id"]
    client.post("/sessions/stop", headers=headers, json={"session_id": session_id})
    with SessionLocal() as db:
        db.get(ProductionSession, session_id).duration_seconds = duration_minutes * 60
        db.commit()
    return session_id


def _reflect(client, headers, session_id: int, focus_ids: list[str], primary: str | None = None):
    return client.patch(
        f"/sessions/item/{session_id}",
        headers=headers,
        json={"skill_focus_ids": focus_ids, "primary_skill_focus_id": primary},
    )


def _progress_by_skill(client, headers, session_id: int) -> dict[str, dict]:
    response = client.get(f"/sessions/item/{session_id}/skill-progress", headers=headers)
    return {item["skill_id"]: item for item in response.json()}


def _sources_by_skill(session_id: int) -> dict[str, str]:
    with SessionLocal() as db:
        rows = db.scalars(
            select(SessionSkillFocus).where(SessionSkillFocus.session_id == session_id)
        ).all()
        return {row.skill_id: row.source for row in rows}


def test_start_without_focuses_returns_empty_list(client):
    headers = _auth_headers(client, "focus-none@example.com", "focus-none")

    started = _start(client, headers, session_type="mixing")

    assert started.status_code == 201
    assert started.json()["skill_focus_ids"] == []


def test_start_with_focuses_persists_them_in_order(client):
    headers = _auth_headers(client, "focus-start@example.com", "focus-start")

    started = _start(
        client, headers, session_type="mixing", skill_focus_ids=["mixing.eq", "mixing.dynamics"]
    )

    assert started.status_code == 201
    assert started.json()["skill_focus_ids"] == ["mixing.eq", "mixing.dynamics"]
    active = client.get("/sessions/active", headers=headers)
    assert active.json()["skill_focus_ids"] == ["mixing.eq", "mixing.dynamics"]


def test_start_marks_focuses_as_planned(client):
    headers = _auth_headers(client, "focus-planned@example.com", "focus-planned")

    started = _start(client, headers, session_type="mixing", skill_focus_ids=["mixing.eq"])

    assert _sources_by_skill(started.json()["id"]) == {"mixing.eq": "planned"}


def test_start_deduplicates_focuses(client):
    headers = _auth_headers(client, "focus-dedupe@example.com", "focus-dedupe")

    started = _start(
        client, headers, session_type="mixing", skill_focus_ids=["mixing.eq", "mixing.eq"]
    )

    assert started.status_code == 201
    assert started.json()["skill_focus_ids"] == ["mixing.eq"]


def test_start_rejects_more_than_two_focuses(client):
    headers = _auth_headers(client, "focus-many@example.com", "focus-many")

    started = _start(
        client,
        headers,
        session_type="mixing",
        skill_focus_ids=["mixing.eq", "mixing.dynamics", "mixing.space"],
    )

    assert started.status_code == 422


def test_start_rejects_unknown_focus(client):
    headers = _auth_headers(client, "focus-unknown@example.com", "focus-unknown")

    started = _start(client, headers, session_type="mixing", skill_focus_ids=["mixing.vibes"])

    assert started.status_code == 422


def test_start_rejects_focus_from_another_branch(client):
    headers = _auth_headers(client, "focus-branch@example.com", "focus-branch")

    started = _start(client, headers, session_type="beat_making", skill_focus_ids=["mixing.eq"])

    assert started.status_code == 422


def test_mix_and_master_accepts_mixing_and_mastering_focuses(client):
    headers = _auth_headers(client, "focus-mm@example.com", "focus-mm")

    started = _start(
        client,
        headers,
        session_type="mix_and_master",
        skill_focus_ids=["mixing.eq", "mastering.loudness"],
    )

    assert started.status_code == 201


def test_learning_accepts_focus_from_any_branch(client):
    headers = _auth_headers(client, "focus-learn@example.com", "focus-learn")

    started = _start(
        client, headers, session_type="learning", skill_focus_ids=["sound_design.modulation"]
    )

    assert started.status_code == 201


def test_update_after_stop_adds_reflected_focus_and_keeps_planned(client):
    headers = _auth_headers(client, "focus-reflect@example.com", "focus-reflect")
    session_id = _start(
        client, headers, session_type="mixing", skill_focus_ids=["mixing.eq"]
    ).json()["id"]
    client.post("/sessions/stop", headers=headers, json={"session_id": session_id})

    updated = client.patch(
        f"/sessions/item/{session_id}",
        headers=headers,
        json={"skill_focus_ids": ["mixing.eq", "mixing.automation"]},
    )

    assert updated.status_code == 200
    assert updated.json()["skill_focus_ids"] == ["mixing.eq", "mixing.automation"]
    assert _sources_by_skill(session_id) == {"mixing.eq": "planned", "mixing.automation": "reflected"}


def test_update_can_clear_focuses(client):
    headers = _auth_headers(client, "focus-clear@example.com", "focus-clear")
    session_id = _start(
        client, headers, session_type="mixing", skill_focus_ids=["mixing.eq"]
    ).json()["id"]

    updated = client.patch(
        f"/sessions/item/{session_id}", headers=headers, json={"skill_focus_ids": []}
    )

    assert updated.json()["skill_focus_ids"] == []


def test_session_type_change_drops_focuses_from_other_branches(client):
    headers = _auth_headers(client, "focus-type@example.com", "focus-type")
    session_id = _start(
        client, headers, session_type="mix_and_master", skill_focus_ids=["mixing.eq", "mastering.loudness"]
    ).json()["id"]

    updated = client.patch(
        f"/sessions/item/{session_id}", headers=headers, json={"session_type": "mastering"}
    )

    assert updated.json()["skill_focus_ids"] == ["mastering.loudness"]


def test_update_rejects_focus_that_does_not_match_session_type(client):
    headers = _auth_headers(client, "focus-bad-update@example.com", "focus-bad-update")
    session_id = _start(client, headers, session_type="recording").json()["id"]

    updated = client.patch(
        f"/sessions/item/{session_id}", headers=headers, json={"skill_focus_ids": ["mixing.eq"]}
    )

    assert updated.status_code == 422


def test_listed_sessions_include_focuses(client):
    headers = _auth_headers(client, "focus-list@example.com", "focus-list")
    session_id = _start(
        client, headers, session_type="songwriting", skill_focus_ids=["songwriting.hooks"]
    ).json()["id"]
    client.post("/sessions/stop", headers=headers, json={"session_id": session_id})

    listed = client.get("/sessions/list", headers=headers)

    assert listed.json()[0]["skill_focus_ids"] == ["songwriting.hooks"]


def test_single_planned_focus_becomes_the_main_focus(client):
    headers = _auth_headers(client, "focus-single@example.com", "focus-single")

    started = _start(client, headers, session_type="mixing", skill_focus_ids=["mixing.eq"])

    assert started.json()["primary_skill_focus_id"] == "mixing.eq"


def test_two_planned_focuses_have_no_main_focus_yet(client):
    headers = _auth_headers(client, "focus-two@example.com", "focus-two")

    started = _start(
        client, headers, session_type="mixing", skill_focus_ids=["mixing.eq", "mixing.space"]
    )

    assert started.json()["primary_skill_focus_id"] is None


def test_running_session_keeps_the_planned_focus_limit(client):
    headers = _auth_headers(client, "focus-running@example.com", "focus-running")
    session_id = _start(client, headers, session_type="mixing").json()["id"]

    updated = _reflect(
        client, headers, session_id, ["mixing.eq", "mixing.space", "mixing.dynamics"]
    )

    assert updated.status_code == 422


def test_reflecting_after_stop_accepts_every_touched_focus_with_a_main_focus(client):
    headers = _auth_headers(client, "focus-full-pass@example.com", "focus-full-pass")
    session_id = _finished_session(client, headers, duration_minutes=90, session_type="mixing")
    full_pass = [
        "mixing.balance",
        "mixing.eq",
        "mixing.dynamics",
        "mixing.saturation",
        "mixing.space",
        "mixing.stereo",
        "mixing.automation",
        "mixing.translation",
    ]

    updated = _reflect(client, headers, session_id, full_pass, primary="mixing.dynamics")

    assert updated.status_code == 200
    assert updated.json()["skill_focus_ids"] == full_pass
    assert updated.json()["primary_skill_focus_id"] == "mixing.dynamics"


def test_main_focus_must_be_one_of_the_focuses(client):
    headers = _auth_headers(client, "focus-bad-main@example.com", "focus-bad-main")
    session_id = _finished_session(client, headers, duration_minutes=30, session_type="mixing")

    updated = _reflect(client, headers, session_id, ["mixing.eq"], primary="mixing.space")

    assert updated.status_code == 422


def test_removing_the_main_focus_clears_it(client):
    headers = _auth_headers(client, "focus-drop-main@example.com", "focus-drop-main")
    session_id = _finished_session(
        client, headers, duration_minutes=30, session_type="mixing", skill_focus_ids=["mixing.eq"]
    )

    updated = _reflect(client, headers, session_id, ["mixing.space"])

    assert updated.json()["primary_skill_focus_id"] is None


def test_updating_focuses_without_a_main_focus_field_keeps_the_main_focus(client):
    headers = _auth_headers(client, "focus-keep-main@example.com", "focus-keep-main")
    session_id = _finished_session(
        client, headers, duration_minutes=30, session_type="mixing", skill_focus_ids=["mixing.eq"]
    )

    updated = client.patch(
        f"/sessions/item/{session_id}",
        headers=headers,
        json={"skill_focus_ids": ["mixing.eq", "mixing.space"]},
    )

    assert updated.json()["primary_skill_focus_id"] == "mixing.eq"


def test_skill_progress_gives_the_main_focus_half_of_the_session(client):
    headers = _auth_headers(client, "progress-split@example.com", "progress-split")
    session_id = _finished_session(client, headers, duration_minutes=60, session_type="mixing")
    _reflect(
        client, headers, session_id, ["mixing.eq", "mixing.space", "mixing.stereo"], "mixing.eq"
    )

    progress = _progress_by_skill(client, headers, session_id)

    assert progress["mixing.eq"]["gained_seconds"] == 1800
    assert progress["mixing.space"]["gained_seconds"] == 900
    assert progress["mixing.stereo"]["gained_seconds"] == 900


def test_skill_progress_adds_up_earlier_sessions_and_reports_a_level_up(client):
    headers = _auth_headers(client, "progress-level@example.com", "progress-level")
    _finished_session(
        client, headers, duration_minutes=50, session_type="mixing", skill_focus_ids=["mixing.eq"]
    )
    session_id = _finished_session(
        client, headers, duration_minutes=30, session_type="mixing", skill_focus_ids=["mixing.eq"]
    )

    eq = _progress_by_skill(client, headers, session_id)["mixing.eq"]

    assert eq["gained_seconds"] == 1800
    assert eq["total_seconds"] == 4800
    assert (eq["previous_level"], eq["level"]) == (1, 2)
    assert (eq["level_start_seconds"], eq["next_level_seconds"]) == (3600, 10800)


def test_short_sessions_do_not_earn_skill_time(client):
    headers = _auth_headers(client, "progress-short@example.com", "progress-short")
    session_id = _finished_session(
        client, headers, duration_minutes=3, session_type="mixing", skill_focus_ids=["mixing.eq"]
    )

    eq = _progress_by_skill(client, headers, session_id)["mixing.eq"]

    assert (eq["gained_seconds"], eq["total_seconds"]) == (0, 0)


def test_skill_progress_is_private_to_the_session_owner(client):
    owner = _auth_headers(client, "progress-owner@example.com", "progress-owner")
    stranger = _auth_headers(client, "progress-stranger@example.com", "progress-stranger")
    session_id = _finished_session(
        client, owner, duration_minutes=30, session_type="mixing", skill_focus_ids=["mixing.eq"]
    )

    response = client.get(f"/sessions/item/{session_id}/skill-progress", headers=stranger)

    assert response.status_code == 404


def _focus_reflection_events(session_id: int) -> list[dict]:
    with SessionLocal() as db:
        rows = db.scalars(
            select(GrowthEvent).where(GrowthEvent.event_name == "session_focus_reflected")
        ).all()
        props = [json.loads(row.event_props_json) for row in rows]
        return [item for item in props if item["session_id"] == session_id]


def test_reflecting_a_finished_session_is_tracked_once(client):
    headers = _auth_headers(client, "focus-track@example.com", "focus-track")
    session_id = _finished_session(
        client, headers, duration_minutes=60, session_type="mixing", skill_focus_ids=["mixing.eq"]
    )

    _reflect(client, headers, session_id, ["mixing.eq", "mixing.dynamics"], "mixing.eq")
    _reflect(client, headers, session_id, ["mixing.eq"], "mixing.eq")

    assert _focus_reflection_events(session_id) == [
        {
            "session_id": session_id,
            "session_type": "mixing",
            "focus_count": 2,
            "has_main_focus": True,
            "had_planned_focus": True,
        }
    ]


def test_saving_unchanged_focuses_is_not_tracked(client):
    headers = _auth_headers(client, "focus-untracked@example.com", "focus-untracked")
    session_id = _finished_session(
        client, headers, duration_minutes=60, session_type="mixing", skill_focus_ids=["mixing.eq"]
    )

    client.patch(f"/sessions/item/{session_id}", headers=headers, json={"notes": "vocal bus"})
    _reflect(client, headers, session_id, ["mixing.eq"], "mixing.eq")

    assert _focus_reflection_events(session_id) == []


def test_deleting_account_removes_session_focuses(client):
    headers = _auth_headers(client, "focus-delete@example.com", "focus-delete")
    session_id = _start(
        client, headers, session_type="mixing", skill_focus_ids=["mixing.eq"]
    ).json()["id"]
    client.post("/sessions/stop", headers=headers, json={"session_id": session_id})

    deleted = client.delete("/users/me", headers=headers)

    assert deleted.status_code == 204
    assert _sources_by_skill(session_id) == {}
