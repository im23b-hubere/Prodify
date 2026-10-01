from app.services.skill_profile_service import branch_seconds_for_session
from app.services.skill_progress_service import allocate_production_seconds
from tests.auth_helpers import auth_headers as _auth_headers
from tests.test_session_skill_focuses import _finished_session, _progress_by_skill

HOUR = 3600
A_LOT, SOME, A_LITTLE = 3, 2, 1


def _reflect_production(client, headers, session_id: int, *, focus_ids, area_weights, primary=None):
    return client.patch(
        f"/sessions/item/{session_id}",
        headers=headers,
        json={
            "skill_focus_ids": focus_ids,
            "primary_skill_focus_id": primary,
            "area_weights": [{"branch": branch, "weight": weight} for branch, weight in area_weights],
        },
    )


def _branch_seconds(client, headers) -> dict[str, int]:
    profile = client.get("/skills/profile", headers=headers).json()
    return {item["branch"]: item["total_seconds"] for item in profile["branches"]}


def test_area_weights_split_a_production_session_across_areas():
    weights = {"beat_making": A_LOT, "mixing": SOME, "mastering": A_LITTLE}

    assert branch_seconds_for_session("production", 2 * HOUR, [], weights) == {
        "beat_making": 3600,
        "mixing": 2400,
        "mastering": 1200,
    }


def test_areas_of_reflected_focuses_count_as_some_unless_weighted():
    seconds = branch_seconds_for_session(
        "production", 5 * HOUR, ["beat_making.drums", "mixing.eq"], {"mixing": A_LITTLE}
    )

    assert seconds == {"beat_making": 2 * 5 * HOUR // 3, "mixing": 5 * HOUR // 3}


def test_production_session_without_areas_grows_no_area():
    assert branch_seconds_for_session("production", HOUR, [], {}) == {}


def test_each_area_shares_its_time_among_its_own_focuses():
    allocation = allocate_production_seconds(
        2 * HOUR,
        ["beat_making.drums", "mixing.eq", "mixing.space"],
        None,
        {"beat_making": A_LOT, "mixing": SOME, "mastering": A_LITTLE},
    )

    assert allocation == {"beat_making.drums": 3600, "mixing.eq": 1200, "mixing.space": 1200}


def test_main_focus_earns_half_of_its_own_area():
    allocation = allocate_production_seconds(
        2 * HOUR,
        ["beat_making.drums", "beat_making.groove", "beat_making.bass", "mixing.eq"],
        "beat_making.drums",
        {"beat_making": SOME, "mixing": SOME},
    )

    assert allocation == {
        "beat_making.drums": 1800,
        "beat_making.groove": 900,
        "beat_making.bass": 900,
        "mixing.eq": 3600,
    }


def test_short_production_session_earns_no_skill_time():
    assert allocate_production_seconds(240, ["mixing.eq"], None, {"mixing": SOME}) == {}


def test_production_session_accepts_intentions_from_different_areas(client):
    headers = _auth_headers(client, "prod-start@example.com", "prod-start")

    response = client.post(
        "/sessions/start",
        headers=headers,
        json={"session_type": "production", "skill_focus_ids": ["beat_making.groove", "mixing.eq"]},
    )

    assert response.status_code == 201
    assert response.json()["skill_focus_ids"] == ["beat_making.groove", "mixing.eq"]


def test_reflected_area_weights_are_stored_and_returned(client):
    headers = _auth_headers(client, "prod-reflect@example.com", "prod-reflect")
    session_id = _finished_session(client, headers, duration_minutes=120, session_type="production")

    response = _reflect_production(
        client,
        headers,
        session_id,
        focus_ids=["mixing.eq"],
        area_weights=[("beat_making", A_LOT), ("mixing", SOME)],
    )

    assert response.status_code == 200
    assert response.json()["area_weights"] == [
        {"branch": "beat_making", "weight": A_LOT},
        {"branch": "mixing", "weight": SOME},
    ]


def test_area_weights_drive_the_skill_profile(client):
    headers = _auth_headers(client, "prod-profile@example.com", "prod-profile")
    session_id = _finished_session(client, headers, duration_minutes=120, session_type="production")

    _reflect_production(
        client,
        headers,
        session_id,
        focus_ids=["beat_making.drums"],
        area_weights=[("beat_making", A_LOT), ("mixing", SOME), ("mastering", A_LITTLE)],
    )

    branches = _branch_seconds(client, headers)
    assert (branches["beat_making"], branches["mixing"], branches["mastering"]) == (3600, 2400, 1200)
    assert _progress_by_skill(client, headers, session_id)["beat_making.drums"]["gained_seconds"] == 3600


def test_area_weights_only_belong_to_production_sessions(client):
    headers = _auth_headers(client, "prod-mixing@example.com", "prod-mixing")
    session_id = _finished_session(client, headers, duration_minutes=60, session_type="mixing")

    response = _reflect_production(
        client, headers, session_id, focus_ids=[], area_weights=[("mixing", SOME)]
    )

    assert response.status_code == 422


def test_area_weight_must_be_a_little_some_or_a_lot(client):
    headers = _auth_headers(client, "prod-weight@example.com", "prod-weight")
    session_id = _finished_session(client, headers, duration_minutes=60, session_type="production")

    too_heavy = _reflect_production(
        client, headers, session_id, focus_ids=[], area_weights=[("mixing", 4)]
    )
    unknown_area = _reflect_production(
        client, headers, session_id, focus_ids=[], area_weights=[("cooking", SOME)]
    )

    assert (too_heavy.status_code, unknown_area.status_code) == (422, 422)


def test_switching_away_from_production_drops_the_area_weights(client):
    headers = _auth_headers(client, "prod-switch@example.com", "prod-switch")
    session_id = _finished_session(client, headers, duration_minutes=60, session_type="production")
    _reflect_production(client, headers, session_id, focus_ids=[], area_weights=[("mixing", A_LOT)])

    response = client.patch(
        f"/sessions/item/{session_id}", headers=headers, json={"session_type": "mixing"}
    )

    assert response.json()["area_weights"] == []
