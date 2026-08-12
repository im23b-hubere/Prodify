import pytest

from app.services.stats_period import StatsPeriod


@pytest.mark.parametrize(
    ("value", "label", "days"),
    [
        ("week", "week", 7),
        ("30d", "month", 30),
        ("month", "month", 30),
        ("all", "all", None),
        ("unexpected", "week", 7),
    ],
)
def test_stats_period_parsing(value, label, days):
    assert StatsPeriod.parse(value) == StatsPeriod(label, days)
