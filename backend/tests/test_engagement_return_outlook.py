from dataclasses import replace
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.services.engagement.candidates import Candidate, CandidateType, reengagement_candidate
from app.services.engagement.context import EngagementContext
from app.services.engagement.engine import decide
from app.services.engagement.preferences import NotificationCategory, default_preferences
from app.services.engagement.profile import STAGE_COLD_START, STAGE_ESTABLISHED, BehaviorProfile
from app.services.engagement.return_probability import ReturnFeatures, return_features, return_probability
from app.services.engagement.scoring import ScoringSignals, score
from app.services.engagement.segments import Segment, segment_of
from app.services.engagement.timing import production_window

ZURICH = ZoneInfo("Europe/Zurich")
NOW = datetime(2026, 6, 10, 15, 0, tzinfo=ZURICH)  # Wednesday afternoon


def _profile(**overrides) -> BehaviorProfile:
    hours = [0] * 24
    hours[19] = 20
    values = dict(
        total_sessions=20,
        stage=STAGE_ESTABLISHED,
        session_hour_histogram=hours,
        weekday_histogram=[3] * 7,
        avg_sessions_per_week=4,
        avg_session_duration_minutes=60,
        last_session_at=NOW - timedelta(days=1),
        sessions_last_7_days=4,
        sessions_previous_7_days=4,
        last_session_duration_minutes=60,
    )
    values.update(overrides)
    return BehaviorProfile(**values)


def _features(**overrides) -> ReturnFeatures:
    values = dict(
        days_since_last_session=1,
        sessions_last_7_days=4,
        sessions_previous_7_days=4,
        avg_sessions_per_week=4,
        usual_hour_still_ahead_today=True,
        weekday_share=1 / 7,
        has_streak=True,
        streak_at_risk=False,
        has_active_challenge=False,
        has_friend_activity=False,
        notification_response_rate=None,
        last_session_duration_minutes=60,
    )
    values.update(overrides)
    return ReturnFeatures(**values)


def _context(**overrides) -> EngagementContext:
    values = dict(
        user_id=1,
        zone=ZURICH,
        profile=_profile(),
        streak_days=0,
        streak_at_risk=False,
        current_level=3,
        xp_to_next_level=400,
        challenges=(),
        friend_sessions=(),
        leaderboard=None,
        recent_deliveries=(),
    )
    values.update(overrides)
    return EngagementContext(**values)


# --- segments ---------------------------------------------------------------------------------


def test_a_producer_in_the_cold_start_is_a_new_user():
    assert segment_of(_profile(total_sessions=3, stage=STAGE_COLD_START), NOW) == Segment.NEW_USER


def test_fourteen_days_without_a_session_make_a_producer_dormant():
    assert segment_of(_profile(last_session_at=NOW - timedelta(days=14)), NOW) == Segment.DORMANT
    assert segment_of(_profile(last_session_at=NOW - timedelta(days=13)), NOW) != Segment.DORMANT


def test_a_long_gone_beginner_counts_as_dormant_rather_than_new():
    profile = _profile(total_sessions=2, stage=STAGE_COLD_START, last_session_at=NOW - timedelta(days=20))

    assert segment_of(profile, NOW) == Segment.DORMANT


def test_activity_falling_by_more_than_half_puts_a_producer_at_risk():
    assert segment_of(_profile(sessions_previous_7_days=4, sessions_last_7_days=1), NOW) == Segment.AT_RISK
    assert segment_of(_profile(sessions_previous_7_days=4, sessions_last_7_days=2), NOW) != Segment.AT_RISK


def test_a_single_session_week_is_too_little_to_fall_from():
    profile = _profile(avg_sessions_per_week=1, sessions_previous_7_days=1, sessions_last_7_days=0)

    assert segment_of(profile, NOW) == Segment.CASUAL_PRODUCER


@pytest.mark.parametrize(
    ("sessions_per_week", "segment"),
    [(2.75, Segment.CASUAL_PRODUCER), (3, Segment.ACTIVE_PRODUCER), (6.75, Segment.ACTIVE_PRODUCER), (7, Segment.POWER_USER)],
)
def test_the_weekly_pace_separates_casual_active_and_power_users(sessions_per_week, segment):
    assert segment_of(_profile(avg_sessions_per_week=sessions_per_week), NOW) == segment


# --- return probability -----------------------------------------------------------------------


@pytest.mark.parametrize(
    "features",
    [
        _features(),
        _features(days_since_last_session=None, avg_sessions_per_week=0, has_streak=False),
        _features(days_since_last_session=400, avg_sessions_per_week=0, sessions_last_7_days=0, has_streak=False),
        _features(
            days_since_last_session=0,
            avg_sessions_per_week=50,
            sessions_last_7_days=50,
            weekday_share=1,
            streak_at_risk=True,
            has_active_challenge=True,
            has_friend_activity=True,
            notification_response_rate=1,
            last_session_duration_minutes=600,
        ),
    ],
)
def test_the_probability_stays_between_zero_and_one(features):
    assert 0 < return_probability(features) < 1


def test_more_days_away_never_raise_the_probability():
    probabilities = [return_probability(_features(days_since_last_session=days)) for days in range(0, 40)]

    assert all(later <= earlier for earlier, later in zip(probabilities, probabilities[1:]))
    assert probabilities[10] < probabilities[0]


def test_a_regular_producer_is_more_likely_to_return_than_a_lapsed_one():
    regular = return_probability(_features())
    lapsed = return_probability(
        _features(days_since_last_session=12, avg_sessions_per_week=0.5, sessions_last_7_days=0, has_streak=False)
    )

    assert regular > 0.7 > 0.1 > lapsed


def test_features_read_the_usual_hour_and_weekday_from_the_profile():
    weekdays = [0] * 7
    weekdays[2] = 10  # every session on a Wednesday
    features = return_features(
        _profile(weekday_histogram=weekdays),
        NOW,
        streak_days=3,
        streak_at_risk=True,
        has_active_challenge=False,
        has_friend_activity=True,
        notification_response_rate=0.4,
    )

    assert features.usual_hour_still_ahead_today
    assert features.weekday_share == 1
    assert features.has_streak and features.streak_at_risk and features.has_friend_activity
    assert features.last_session_duration_minutes == 60


def test_the_usual_hour_is_behind_once_it_has_passed_today():
    features = return_features(
        _profile(),
        NOW.replace(hour=21),
        streak_days=0,
        streak_at_risk=False,
        has_active_challenge=False,
        has_friend_activity=False,
        notification_response_rate=None,
    )

    assert not features.usual_hour_still_ahead_today


# --- what the engine does with it ---------------------------------------------------------------


def test_a_sharp_drop_since_yesterday_creates_a_reengagement_candidate():
    candidate = reengagement_candidate(_context(return_probability=0.4, previous_return_probability=0.8), NOW)

    assert candidate.type == CandidateType.REENGAGEMENT
    assert "fell from 80% to 40%" in candidate.reason


def test_a_small_dip_creates_no_candidate():
    assert reengagement_candidate(_context(return_probability=0.6, previous_return_probability=0.8), NOW) is None


def test_no_baseline_from_yesterday_creates_no_candidate():
    assert reengagement_candidate(_context(return_probability=0.1, previous_return_probability=None), NOW) is None


def _streak_score(return_probability_value):
    candidate = Candidate(
        type=CandidateType.STREAK_AT_RISK,
        category=NotificationCategory.STREAK,
        base_score=60,
        title="t",
        body="b",
        path="/",
        reason="r",
    )
    signals = ScoringSignals(
        window=production_window(_profile()),
        zone=ZURICH,
        days_since_last_session=1,
        last_smart_sent_at=None,
        motivation={},
        fatigue_score=0,
        return_probability=return_probability_value,
    )
    return score(candidate, signals, NOW).parts["likelyReturn"]


def test_a_producer_who_returns_anyway_costs_the_candidate_points():
    assert _streak_score(None) == 0
    assert _streak_score(0.7) == 0
    assert _streak_score(0.85) == -8
    assert _streak_score(1.0) == -15


def test_dormant_producers_weigh_comeback_pushes_higher_than_power_users():
    lapsed = _profile(last_session_at=NOW - timedelta(days=5), sessions_last_7_days=0, avg_sessions_per_week=7)
    base = _context(profile=lapsed)

    def comeback_score(segment: Segment) -> int:
        decision = decide(replace(base, segment=segment), default_preferences(1), NOW)
        return next(s.total for s in decision.candidates if s.candidate.type == CandidateType.REENGAGEMENT)

    assert comeback_score(Segment.DORMANT) > comeback_score(Segment.CASUAL_PRODUCER) > comeback_score(Segment.POWER_USER)
