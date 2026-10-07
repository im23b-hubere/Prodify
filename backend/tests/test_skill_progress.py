from types import SimpleNamespace

from app.services.skill_progress_service import (
    MAX_COUNTED_SESSION_SECONDS,
    allocate_session_seconds,
    allocate_skill_time,
    area_seconds_from_skill_time,
    counted_skill_seconds,
    main_focus_id,
    skill_level_for,
    wheel_cap_seconds,
)

HOUR = 3600
NINETY_TWO_MIN = 92 * 60


def test_session_without_focuses_earns_no_skill_time():
    assert allocate_session_seconds(3600, [], None) == {}


def test_short_session_earns_no_skill_time():
    assert allocate_session_seconds(240, ["mixing.eq"], "mixing.eq") == {}


def test_forgotten_timer_earns_at_most_the_session_cap():
    allocation = allocate_session_seconds(30 * 3600, ["mixing.eq"], "mixing.eq")

    assert allocation == {"mixing.eq": MAX_COUNTED_SESSION_SECONDS}


def test_time_is_split_evenly_without_a_main_focus():
    assert allocate_session_seconds(3600, ["mixing.eq", "mixing.space"], None) == {
        "mixing.eq": 1800,
        "mixing.space": 1800,
    }


def test_a_single_main_focus_earns_the_whole_session():
    assert allocate_session_seconds(3600, ["mixing.eq"], "mixing.eq") == {"mixing.eq": 3600}


def test_main_focus_earns_half_and_the_rest_is_shared():
    allocation = allocate_session_seconds(
        5400, ["mixing.dynamics", "mixing.eq", "mixing.space"], "mixing.dynamics"
    )

    assert allocation == {"mixing.dynamics": 2700, "mixing.eq": 1350, "mixing.space": 1350}


def test_skill_levels_follow_the_hour_thresholds():
    assert skill_level_for(0).level == 1
    assert skill_level_for(3599).level == 1
    assert skill_level_for(3600).level == 2
    assert skill_level_for(6 * 3600).level == 4


def test_top_skill_level_has_no_next_threshold():
    top = skill_level_for(50 * 3600)

    assert (top.level, top.next_level_seconds) == (7, None)


def test_assigned_times_credit_exactly_those_minutes():
    allocation = allocate_skill_time(
        NINETY_TWO_MIN,
        ["mixing.stereo", "mixing.eq"],
        assigned_seconds={"mixing.stereo": 40 * 60, "mixing.eq": 20 * 60},
    )

    assert allocation == {"mixing.stereo": 40 * 60, "mixing.eq": 20 * 60}


def test_unassigned_minutes_do_not_grow_the_tree():
    allocation = allocate_skill_time(
        NINETY_TWO_MIN,
        ["mixing.stereo", "mixing.eq"],
        assigned_seconds={"mixing.stereo": 40 * 60, "mixing.eq": 20 * 60},
    )

    assert sum(allocation.values()) == 60 * 60


def test_budget_gives_zero_to_tapped_focuses_without_minutes():
    allocation = allocate_skill_time(
        NINETY_TWO_MIN,
        ["mixing.stereo", "mixing.eq", "mixing.space"],
        assigned_seconds={"mixing.stereo": NINETY_TWO_MIN},
    )

    assert allocation == {
        "mixing.stereo": NINETY_TWO_MIN,
        "mixing.eq": 0,
        "mixing.space": 0,
    }


def test_assigning_zero_is_budget_mode_not_an_even_split():
    allocation = allocate_skill_time(
        HOUR,
        ["mixing.eq", "mixing.space"],
        assigned_seconds={"mixing.eq": 0},
    )

    assert allocation == {"mixing.eq": 0, "mixing.space": 0}


def test_skip_path_splits_evenly_when_nothing_is_assigned():
    allocation = allocate_skill_time(HOUR, ["mixing.eq", "mixing.space", "mixing.dynamics"])

    assert allocation == {
        "mixing.eq": 1200,
        "mixing.space": 1200,
        "mixing.dynamics": 1200,
    }


def test_short_session_still_earns_no_skill_time_when_minutes_are_assigned():
    assert allocate_skill_time(240, ["mixing.eq"], assigned_seconds={"mixing.eq": 240}) == {}


def test_assigned_times_never_exceed_the_counted_duration():
    allocation = allocate_skill_time(
        HOUR,
        ["mixing.eq", "mixing.space"],
        assigned_seconds={"mixing.eq": 50 * 60, "mixing.space": 50 * 60},
    )

    assert allocation == {"mixing.eq": 50 * 60, "mixing.space": 10 * 60}
    assert sum(allocation.values()) == HOUR


def test_overnight_cap_still_bounds_assigned_times():
    allocation = allocate_skill_time(
        30 * HOUR,
        ["mixing.eq"],
        assigned_seconds={"mixing.eq": 30 * HOUR},
    )

    assert allocation == {"mixing.eq": MAX_COUNTED_SESSION_SECONDS}


def test_production_with_no_stored_weights_still_uses_the_area_split():
    allocation = allocate_skill_time(
        HOUR,
        ["beat_making.drums", "mixing.eq", "mixing.space"],
        primary_focus_id=None,
        weight_by_area={},
    )

    assert allocation == {
        "beat_making.drums": 1800,
        "mixing.eq": 900,
        "mixing.space": 900,
    }


def test_legacy_weights_still_split_when_nothing_is_assigned():
    allocation = allocate_skill_time(
        2 * HOUR,
        ["beat_making.drums", "mixing.eq", "mixing.space"],
        primary_focus_id=None,
        weight_by_area={"beat_making": 3, "mixing": 2, "mastering": 1},
    )

    assert allocation == {"beat_making.drums": 3600, "mixing.eq": 1200, "mixing.space": 1200}


def test_area_time_is_the_sum_of_assigned_focuses():
    allocation = allocate_skill_time(
        NINETY_TWO_MIN,
        ["mixing.eq", "beat_making.drums"],
        assigned_seconds={"mixing.eq": 40 * 60, "beat_making.drums": 20 * 60},
    )

    assert area_seconds_from_skill_time(allocation) == {
        "mixing": 40 * 60,
        "beat_making": 20 * 60,
    }


def test_main_focus_is_the_unique_longest_assignment():
    allocation = {"mixing.stereo": 40 * 60, "mixing.eq": 20 * 60}

    assert main_focus_id(allocation) == "mixing.stereo"
    assert main_focus_id({"mixing.eq": 1800, "mixing.space": 1800}) is None
    assert main_focus_id({"mixing.eq": 0}) is None


def test_wheel_cap_is_this_focus_plus_what_is_still_unassigned():
    assigned = {"mixing.stereo": 40 * 60, "mixing.eq": 20 * 60}

    assert wheel_cap_seconds(NINETY_TWO_MIN, assigned, "mixing.eq") == 20 * 60 + 32 * 60
    assert wheel_cap_seconds(NINETY_TWO_MIN, assigned, "mixing.space") == 32 * 60


def test_counted_skill_seconds_uses_budget_when_a_focus_has_assigned_time():
    session = SimpleNamespace(
        stopped_at="done",
        deleted_at=None,
        session_type="mixing",
        duration_seconds=NINETY_TWO_MIN,
        skill_focus_ids=["mixing.stereo", "mixing.eq"],
        primary_skill_focus_id=None,
        weight_by_area={},
        skill_focuses=[
            SimpleNamespace(skill_id="mixing.stereo", assigned_seconds=40 * 60),
            SimpleNamespace(skill_id="mixing.eq", assigned_seconds=20 * 60),
        ],
    )

    assert counted_skill_seconds(session) == {
        "mixing.stereo": 40 * 60,
        "mixing.eq": 20 * 60,
    }


def test_counted_skill_seconds_keeps_the_legacy_split_when_assigned_time_is_missing():
    session = SimpleNamespace(
        stopped_at="done",
        deleted_at=None,
        session_type="mixing",
        duration_seconds=HOUR,
        skill_focus_ids=["mixing.eq", "mixing.space"],
        primary_focus_id=None,
        primary_skill_focus_id="mixing.eq",
        weight_by_area={},
        skill_focuses=[
            SimpleNamespace(skill_id="mixing.eq", assigned_seconds=None),
            SimpleNamespace(skill_id="mixing.space", assigned_seconds=None),
        ],
    )

    assert counted_skill_seconds(session) == {"mixing.eq": 1800, "mixing.space": 1800}
