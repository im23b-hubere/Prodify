from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.services.engagement.candidates import Candidate, CandidateType
from app.services.engagement.preferences import NotificationCategory
from app.services.engagement.priority import Priority, priority_of
from app.services.engagement.scoring import DEFAULT_WEIGHTS, ScoringSignals, ScoringWeights, score
from app.services.engagement.timing import ProductionWindow

ZURICH = ZoneInfo("Europe/Zurich")
TUESDAY_EVENING = datetime(2026, 6, 9, 19, 10, tzinfo=ZURICH)
TUESDAY_WINDOW = ProductionWindow(weekdays=(1,), start_hour=19, end_hour=22)


def _candidate(category=NotificationCategory.SOCIAL, base_score=50, **overrides) -> Candidate:
    values = dict(
        type=CandidateType.SOCIAL_OVERTAKEN,
        category=category,
        base_score=base_score,
        title="t",
        body="b",
        path="/",
        reason="r",
    )
    values.update(overrides)
    return Candidate(**values)


def _signals(**overrides) -> ScoringSignals:
    values = dict(
        window=TUESDAY_WINDOW,
        zone=ZURICH,
        days_since_last_session=1,
        last_smart_sent_at=None,
        motivation={},
        fatigue_score=0,
    )
    values.update(overrides)
    return ScoringSignals(**values)


def test_the_trigger_score_lands_in_its_category_summand():
    breakdown = score(_candidate(base_score=50), _signals(), TUESDAY_EVENING)

    assert breakdown.parts["social"] == 50
    assert breakdown.parts["streak"] == 0


def test_reengagement_urgency_counts_as_inactivity():
    candidate = _candidate(category=NotificationCategory.REENGAGEMENT, type=CandidateType.REENGAGEMENT, base_score=40)

    assert score(candidate, _signals(days_since_last_session=5), TUESDAY_EVENING).parts["inactivity"] == 40


def test_inside_the_production_window_adds_a_time_match():
    inside = score(_candidate(), _signals(), TUESDAY_EVENING)
    outside = score(_candidate(), _signals(), TUESDAY_EVENING.replace(hour=11))

    assert inside.parts["timeMatch"] == DEFAULT_WEIGHTS.time_match
    assert outside.parts["timeMatch"] == 0


def test_shortly_before_the_window_earns_part_of_the_time_match():
    breakdown = score(_candidate(), _signals(), TUESDAY_EVENING.replace(hour=18, minute=30))

    assert breakdown.parts["timeMatch"] == DEFAULT_WEIGHTS.time_near


def test_a_few_quiet_days_raise_every_candidate():
    breakdown = score(_candidate(), _signals(days_since_last_session=2), TUESDAY_EVENING)

    assert breakdown.parts["inactivity"] == DEFAULT_WEIGHTS.inactivity


def test_a_category_the_producer_responds_to_scores_higher():
    responsive = score(_candidate(), _signals(motivation={NotificationCategory.SOCIAL: 0.45}), TUESDAY_EVENING)
    unresponsive = score(_candidate(), _signals(motivation={NotificationCategory.SOCIAL: 0.05}), TUESDAY_EVENING)

    assert responsive.parts["motivation"] == 8
    assert unresponsive.parts["motivation"] == -8


def test_fatigue_is_subtracted():
    assert score(_candidate(), _signals(fatigue_score=15), TUESDAY_EVENING).parts["fatigue"] == -15


def test_a_recent_notification_costs_points_that_fade_over_a_day():
    three_hours = score(_candidate(), _signals(last_smart_sent_at=TUESDAY_EVENING - timedelta(hours=3)), TUESDAY_EVENING)
    a_day = score(_candidate(), _signals(last_smart_sent_at=TUESDAY_EVENING - timedelta(hours=26)), TUESDAY_EVENING)

    assert three_hours.parts["recentNotificationPenalty"] < -20
    assert a_day.parts["recentNotificationPenalty"] == 0


def test_the_total_is_the_sum_of_its_parts():
    breakdown = score(_candidate(base_score=50), _signals(fatigue_score=10), TUESDAY_EVENING)

    assert breakdown.total == sum(breakdown.parts.values()) == 50 + 25 - 10


def test_weights_scale_a_category():
    weights = ScoringWeights(category_multipliers={NotificationCategory.SOCIAL: 0.5})

    assert score(_candidate(base_score=50), _signals(), TUESDAY_EVENING, weights).parts["social"] == 25


def test_score_bands():
    assert priority_of(34) == Priority.DO_NOT_SEND
    assert priority_of(35) == Priority.LOW
    assert priority_of(49) == Priority.LOW
    assert priority_of(50) == Priority.GOOD
    assert priority_of(70) == Priority.HIGH
