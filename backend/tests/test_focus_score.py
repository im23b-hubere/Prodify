import pytest

from app.achievementsutil import calculate_focus_score


@pytest.mark.parametrize(
    ("arguments", "expected"),
    [
        ({"duration_minutes": 0, "paused_duration_minutes": 0, "notes_length": 0, "mood_level": None}, 0),
        ({"duration_minutes": 10, "paused_duration_minutes": 0, "notes_length": 0, "mood_level": 3}, 88),
        ({"duration_minutes": 25, "paused_duration_minutes": 5, "notes_length": 50, "mood_level": 3}, 85),
        ({"duration_minutes": 100, "paused_duration_minutes": 0, "notes_length": 101, "mood_level": 5}, 100),
        (
            {
                "duration_minutes": 30,
                "paused_duration_minutes": 15,
                "notes_length": 0,
                "mood_level": 2,
                "pause_count": 6,
                "background_switches": 11,
                "time_of_day": 3,
            },
            26,
        ),
    ],
)
def test_calculate_focus_score_thresholds(arguments, expected):
    assert calculate_focus_score(**arguments) == expected
