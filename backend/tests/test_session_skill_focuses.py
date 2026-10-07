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


def _session_started_event(session_id: int) -> dict:
    with SessionLocal() as db:
        rows = db.scalars(
            select(GrowthEvent).where(GrowthEvent.event_name == "session_started")
        ).all()
        props = [json.loads(row.event_props_json) for row in rows]
        return next(item for item in props if item["session_id"] == session_id)


def test_session_start_records_which_suggestions_were_taken(client):
    headers = _auth_headers(client, "focus-suggested@example.com", "focus-suggested")

    session_id = _start(
        client,
        headers,
        session_type="mixing",
        skill_focus_ids=["mixing.eq"],
        suggested_skill_focus_ids=["mixing.eq", "mixing.space"],
    ).json()["id"]

    event = _session_started_event(session_id)
    assert event["suggested_focus_ids"] == ["mixing.eq", "mixing.space"]
    assert event["accepted_suggestion_ids"] == ["mixing.eq"]


def test_session_start_without_suggestions_records_none(client):
    headers = _auth_headers(client, "focus-unsuggested@example.com", "focus-unsuggested")

    session_id = _start(client, headers, session_type="mixing").json()["id"]

    event = _session_started_event(session_id)
    assert (event["suggested_focus_ids"], event["accepted_suggestion_ids"]) == ([], [])


def test_unknown_suggestions_never_block_a_session_start(client):
    headers = _auth_headers(client, "focus-odd-suggestion@example.com", "focus-odd-suggestion")

    response = _start(
        client,
        headers,
        session_type="mixing",
        suggested_skill_focus_ids=["mixing.future_skill", "mixing.eq", "mixing.eq", "mixing.space"],
    )

    assert response.status_code == 201
    event = _session_started_event(response.json()["id"])
    assert event["suggested_focus_ids"] == ["mixing.eq", "mixing.space"]


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
            "area_count": 0,
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


def _assign(client, headers, session_id: int, focus_ids: list[str], times: list[tuple[str, int | None]]):
    return client.patch(
        f"/sessions/item/{session_id}",
        headers=headers,
        json={
            "skill_focus_ids": focus_ids,
            "focus_times": [
                {"skill_id": skill_id, "assigned_seconds": seconds} for skill_id, seconds in times
            ],
        },
    )


def test_assigned_times_are_stored_and_returned(client):
    headers = _auth_headers(client, "focus-times@example.com", "focus-times")
    session_id = _finished_session(client, headers, duration_minutes=92, session_type="mixing")

    updated = _assign(
        client,
        headers,
        session_id,
        ["mixing.stereo", "mixing.eq"],
        [("mixing.stereo", 40 * 60), ("mixing.eq", 20 * 60)],
    )

    assert updated.status_code == 200
    assert updated.json()["focus_times"] == [
        {"skill_id": "mixing.stereo", "assigned_seconds": 40 * 60},
        {"skill_id": "mixing.eq", "assigned_seconds": 20 * 60},
    ]


def test_skill_progress_uses_assigned_times(client):
    headers = _auth_headers(client, "focus-times-progress@example.com", "focus-times-progress")
    session_id = _finished_session(client, headers, duration_minutes=92, session_type="mixing")
    _assign(
        client,
        headers,
        session_id,
        ["mixing.stereo", "mixing.eq"],
        [("mixing.stereo", 40 * 60), ("mixing.eq", 20 * 60)],
    )

    progress = _progress_by_skill(client, headers, session_id)

    assert progress["mixing.stereo"]["gained_seconds"] == 40 * 60
    assert progress["mixing.eq"]["gained_seconds"] == 20 * 60


def test_omitting_focus_times_keeps_the_even_split(client):
    headers = _auth_headers(client, "focus-times-skip@example.com", "focus-times-skip")
    session_id = _finished_session(client, headers, duration_minutes=60, session_type="mixing")

    updated = _reflect(client, headers, session_id, ["mixing.eq", "mixing.space"])

    assert updated.json()["focus_times"] == []
    progress = _progress_by_skill(client, headers, session_id)
    assert progress["mixing.eq"]["gained_seconds"] == 1800
    assert progress["mixing.space"]["gained_seconds"] == 1800


def test_assigning_zero_is_budget_not_an_even_split(client):
    headers = _auth_headers(client, "focus-times-zero@example.com", "focus-times-zero")
    session_id = _finished_session(client, headers, duration_minutes=60, session_type="mixing")
    _assign(
        client,
        headers,
        session_id,
        ["mixing.stereo", "mixing.eq"],
        [("mixing.stereo", 40 * 60), ("mixing.eq", 0)],
    )

    progress = _progress_by_skill(client, headers, session_id)

    assert progress["mixing.stereo"]["gained_seconds"] == 40 * 60
    assert progress["mixing.eq"]["gained_seconds"] == 0


def test_assigned_time_over_the_session_is_rejected(client):
    headers = _auth_headers(client, "focus-times-overflow@example.com", "focus-times-overflow")
    session_id = _finished_session(client, headers, duration_minutes=60, session_type="mixing")

    updated = _assign(
        client,
        headers,
        session_id,
        ["mixing.stereo", "mixing.eq"],
        [("mixing.stereo", 40 * 60), ("mixing.eq", 30 * 60)],
    )

    assert updated.status_code == 422
    assert _progress_by_skill(client, headers, session_id) == {}


def test_assigned_time_must_be_on_a_tapped_focus(client):
    headers = _auth_headers(client, "focus-times-untapped@example.com", "focus-times-untapped")
    session_id = _finished_session(client, headers, duration_minutes=60, session_type="mixing")

    updated = _assign(
        client,
        headers,
        session_id,
        ["mixing.stereo", "mixing.eq"],
        [("mixing.space", 10 * 60)],
    )

    assert updated.status_code == 422


def test_negative_assigned_time_is_rejected(client):
    headers = _auth_headers(client, "focus-times-neg@example.com", "focus-times-neg")
    session_id = _finished_session(client, headers, duration_minutes=60, session_type="mixing")

    updated = _assign(
        client,
        headers,
        session_id,
        ["mixing.eq"],
        [("mixing.eq", -1)],
    )

    assert updated.status_code == 422


def test_unique_longest_assignment_becomes_the_main_focus(client):
    headers = _auth_headers(client, "focus-times-main@example.com", "focus-times-main")
    session_id = _finished_session(client, headers, duration_minutes=60, session_type="mixing")

    unique = _assign(
        client,
        headers,
        session_id,
        ["mixing.stereo", "mixing.eq"],
        [("mixing.stereo", 40 * 60), ("mixing.eq", 20 * 60)],
    )
    tied = _assign(
        client,
        headers,
        session_id,
        ["mixing.stereo", "mixing.eq"],
        [("mixing.stereo", 20 * 60), ("mixing.eq", 20 * 60)],
    )

    assert unique.json()["primary_skill_focus_id"] == "mixing.stereo"
    assert tied.json()["primary_skill_focus_id"] is None


def test_clearing_focus_times_returns_to_an_even_split(client):
    headers = _auth_headers(client, "focus-times-clear@example.com", "focus-times-clear")
    session_id = _finished_session(client, headers, duration_minutes=60, session_type="mixing")
    _assign(
        client,
        headers,
        session_id,
        ["mixing.eq", "mixing.space"],
        [("mixing.eq", 40 * 60), ("mixing.space", 10 * 60)],
    )

    cleared = client.patch(
        f"/sessions/item/{session_id}",
        headers=headers,
        json={"focus_times": []},
    )

    assert cleared.json()["focus_times"] == []
    assert cleared.json()["primary_skill_focus_id"] is None
    progress = _progress_by_skill(client, headers, session_id)
    assert progress["mixing.eq"]["gained_seconds"] == 1800
    assert progress["mixing.space"]["gained_seconds"] == 1800


def test_adding_a_focus_without_times_keeps_existing_assignments(client):
    headers = _auth_headers(client, "focus-times-keep@example.com", "focus-times-keep")
    session_id = _finished_session(client, headers, duration_minutes=60, session_type="mixing")
    _assign(
        client,
        headers,
        session_id,
        ["mixing.stereo", "mixing.eq"],
        [("mixing.stereo", 40 * 60), ("mixing.eq", 10 * 60)],
    )

    updated = client.patch(
        f"/sessions/item/{session_id}",
        headers=headers,
        json={"skill_focus_ids": ["mixing.stereo", "mixing.eq", "mixing.space"]},
    )

    assert updated.json()["focus_times"] == [
        {"skill_id": "mixing.stereo", "assigned_seconds": 40 * 60},
        {"skill_id": "mixing.eq", "assigned_seconds": 10 * 60},
    ]


def test_running_session_rejects_assigned_time(client):
    headers = _auth_headers(client, "focus-times-running@example.com", "focus-times-running")
    session_id = _start(client, headers, session_type="mixing").json()["id"]

    updated = _assign(client, headers, session_id, ["mixing.eq"], [("mixing.eq", 10 * 60)])

    assert updated.status_code == 422


def test_short_session_rejects_assigned_time(client):
    headers = _auth_headers(client, "focus-times-short@example.com", "focus-times-short")
    session_id = _finished_session(
        client, headers, duration_minutes=3, session_type="mixing", skill_focus_ids=["mixing.eq"]
    )

    updated = _assign(client, headers, session_id, ["mixing.eq"], [("mixing.eq", 60)])

    assert updated.status_code == 422
    assert _progress_by_skill(client, headers, session_id)["mixing.eq"]["gained_seconds"] == 0


def test_production_assigned_minutes_split_areas_without_weights(client):
    headers = _auth_headers(client, "focus-times-prod@example.com", "focus-times-prod")
    session_id = _finished_session(client, headers, duration_minutes=60, session_type="production")
    _assign(
        client,
        headers,
        session_id,
        ["beat_making.drums", "mixing.eq"],
        [("beat_making.drums", 30 * 60), ("mixing.eq", 15 * 60)],
    )

    progress = _progress_by_skill(client, headers, session_id)
    profile = client.get("/skills/profile", headers=headers).json()
    areas = {item["branch"]: item["total_seconds"] for item in profile["branches"]}

    assert progress["beat_making.drums"]["gained_seconds"] == 30 * 60
    assert progress["mixing.eq"]["gained_seconds"] == 15 * 60
    assert (areas["beat_making"], areas["mixing"]) == (30 * 60, 15 * 60)


def test_assigned_minutes_cut_unassigned_time_out_of_the_area(client):
    headers = _auth_headers(client, "focus-times-area@example.com", "focus-times-area")
    session_id = _finished_session(client, headers, duration_minutes=92, session_type="mixing")
    _assign(
        client,
        headers,
        session_id,
        ["mixing.stereo", "mixing.eq"],
        [("mixing.stereo", 40 * 60), ("mixing.eq", 20 * 60)],
    )

    profile = client.get("/skills/profile", headers=headers).json()
    mixing = next(item for item in profile["branches"] if item["branch"] == "mixing")
    stats = client.get("/sessions/stats?period=week", headers=headers).json()
    week_areas = {item["branch"]: item["seconds"] for item in stats["branch_seconds"]}

    assert mixing["total_seconds"] == 60 * 60
    assert week_areas == {"mixing": 60 * 60}


def test_legacy_weights_and_main_focus_still_split_without_focus_times(client):
    headers = _auth_headers(client, "focus-times-legacy@example.com", "focus-times-legacy")
    session_id = _finished_session(client, headers, duration_minutes=60, session_type="mixing")
    _reflect(
        client, headers, session_id, ["mixing.eq", "mixing.space", "mixing.stereo"], "mixing.eq"
    )

    progress = _progress_by_skill(client, headers, session_id)

    assert progress["mixing.eq"]["gained_seconds"] == 1800
    assert progress["mixing.space"]["gained_seconds"] == 900
    assert progress["mixing.stereo"]["gained_seconds"] == 900


def test_deleting_account_removes_session_focuses(client):
    headers = _auth_headers(client, "focus-delete@example.com", "focus-delete")
    session_id = _start(
        client, headers, session_type="mixing", skill_focus_ids=["mixing.eq"]
    ).json()["id"]
    client.post("/sessions/stop", headers=headers, json={"session_id": session_id})

    deleted = client.delete("/users/me", headers=headers)

    assert deleted.status_code == 204
    assert _sources_by_skill(session_id) == {}
