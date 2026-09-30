from app.services.skill_progress_service import (
    MAX_COUNTED_SESSION_SECONDS,
    allocate_session_seconds,
    skill_level_for,
)


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
