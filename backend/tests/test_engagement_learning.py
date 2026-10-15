from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest

from app.models import DeliveryOutcome
from app.services.engagement.fatigue import (
    MAX_FATIGUE,
    fatigue_gate,
    fatigue_score_of,
    ignored_streak_of,
)
from app.services.engagement.motivation import (
    CATEGORY_PRIORS,
    motivation_scores,
    preferred_notification_hour,
    smoothed_rate,
)
from app.services.engagement.preferences import NotificationCategory
from app.services.engagement.profile import STAGE_ESTABLISHED, STAGE_LEARNING
from app.services.engagement.priority import HIGH_THRESHOLD, SEND_THRESHOLD

NOW = datetime(2026, 6, 10, 19, 0, tzinfo=timezone.utc)
ZURICH = ZoneInfo("Europe/Zurich")
IGNORED, CONVERTED, OPENED = DeliveryOutcome.IGNORED, DeliveryOutcome.CONVERTED, DeliveryOutcome.OPENED_ONLY


def _sent(outcome: str, *, notification_type: str = "social_overtaken", hours_ago: float = 24, hour: int | None = None):
    sent_at = NOW - timedelta(hours=hours_ago)
    if hour is not None:
        sent_at = sent_at.replace(hour=hour)
    return SimpleNamespace(notification_type=notification_type, outcome=outcome, sent_at=sent_at)


# --- fatigue ----------------------------------------------------------------------------------


def test_the_ignored_streak_counts_the_latest_pushes_in_a_row():
    assert ignored_streak_of([CONVERTED, IGNORED, IGNORED]) == 2
    assert ignored_streak_of([IGNORED, CONVERTED]) == 0
    assert ignored_streak_of([IGNORED, OPENED]) == 0
    assert ignored_streak_of([]) == 0


@pytest.mark.parametrize(
    ("ignored", "pause", "min_score"),
    [
        (0, None, SEND_THRESHOLD),
        (1, None, SEND_THRESHOLD),
        (2, timedelta(hours=24), SEND_THRESHOLD),
        (3, timedelta(hours=48), SEND_THRESHOLD),
        (4, timedelta(hours=48), HIGH_THRESHOLD),
        (7, timedelta(hours=48), HIGH_THRESHOLD),
    ],
)
def test_fatigue_rules(ignored, pause, min_score):
    last_sent = NOW - timedelta(hours=1)

    gate = fatigue_gate(ignored, last_sent)

    assert gate.paused_until == (last_sent + pause if pause else None)
    assert gate.min_score == min_score


def test_one_ignored_push_costs_a_little_score():
    assert 0 < fatigue_score_of([IGNORED]) <= 10


def test_conversions_bring_fatigue_back_down():
    tired = fatigue_score_of([IGNORED, IGNORED, IGNORED])
    recovering = fatigue_score_of([IGNORED, IGNORED, IGNORED, CONVERTED])
    recovered = fatigue_score_of([IGNORED, IGNORED, IGNORED, CONVERTED, CONVERTED])

    assert tired > recovering > recovered >= 0


def test_fatigue_is_capped():
    assert fatigue_score_of([IGNORED] * 50) == MAX_FATIGUE


# --- motivation -------------------------------------------------------------------------------


def test_smoothing_keeps_one_lucky_push_from_counting_as_certain():
    assert smoothed_rate(conversions=1, sent=1, prior=0.25) < 0.5


def test_with_plenty_of_data_the_own_rate_wins():
    assert smoothed_rate(conversions=45, sent=100, prior=0.25) == pytest.approx(0.45, abs=0.02)


def test_without_data_the_prior_stands():
    assert motivation_scores([]) == CATEGORY_PRIORS


def test_a_converted_social_push_raises_social_motivation():
    scores = motivation_scores([_sent(CONVERTED)])

    assert scores[NotificationCategory.SOCIAL] > CATEGORY_PRIORS[NotificationCategory.SOCIAL]


def test_ignored_rank_pushes_lower_rank_motivation():
    scores = motivation_scores([_sent(IGNORED, notification_type="rank_close")] * 3)

    assert scores[NotificationCategory.RANK] < CATEGORY_PRIORS[NotificationCategory.RANK]
    assert scores[NotificationCategory.SOCIAL] == CATEGORY_PRIORS[NotificationCategory.SOCIAL]


def test_transactional_and_pending_pushes_teach_nothing():
    history = [_sent(CONVERTED, notification_type="session_complete"), _sent(DeliveryOutcome.PENDING)]

    assert motivation_scores(history) == CATEGORY_PRIORS


def test_recomputing_from_the_same_history_gives_the_same_scores():
    history = [_sent(CONVERTED), _sent(IGNORED, notification_type="rank_close")]

    assert motivation_scores(history) == motivation_scores(list(history))


# --- adaptive timing --------------------------------------------------------------------------


def test_an_established_producer_learns_the_hour_they_answer():
    history = [_sent(CONVERTED, hours_ago=24 * day, hour=17) for day in range(1, 4)]
    history += [_sent(IGNORED, hours_ago=24 * day, hour=12) for day in range(1, 4)]

    assert preferred_notification_hour(history, ZURICH, STAGE_ESTABLISHED) == 19


def test_too_few_pushes_at_an_hour_teach_no_hour():
    history = [_sent(CONVERTED, hours_ago=24 * day, hour=17) for day in range(1, 3)]

    assert preferred_notification_hour(history, ZURICH, STAGE_ESTABLISHED) is None


def test_producers_still_learning_keep_the_window_heuristic():
    history = [_sent(CONVERTED, hours_ago=24 * day, hour=17) for day in range(1, 4)]

    assert preferred_notification_hour(history, ZURICH, STAGE_LEARNING) is None


def test_an_hour_no_better_than_the_baseline_is_not_preferred():
    history = [_sent(IGNORED, hours_ago=24 * day, hour=17) for day in range(1, 6)]

    assert preferred_notification_hour(history, ZURICH, STAGE_ESTABLISHED) is None
