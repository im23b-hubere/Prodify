from datetime import datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from app.services.engagement.candidates import CandidateType
from app.services.engagement.context import EngagementContext, LeaderboardStanding
from app.services.engagement.engine import decide
from app.services.engagement.limits import LimitReason
from app.services.engagement.preferences import NotificationCategory, default_preferences
from app.services.engagement.profile import STAGE_ESTABLISHED, BehaviorProfile

ZURICH = ZoneInfo("Europe/Zurich")
TUESDAY_EVENING = datetime(2026, 6, 9, 19, 10, tzinfo=ZURICH)


def _tuesday_producer() -> BehaviorProfile:
    hours = [0] * 24
    hours[19], hours[20], hours[21] = 8, 6, 4
    weekdays = [0] * 7
    weekdays[1] = 18
    return BehaviorProfile(
        total_sessions=18,
        stage=STAGE_ESTABLISHED,
        session_hour_histogram=hours,
        weekday_histogram=weekdays,
        avg_sessions_per_week=1,
        avg_session_duration_minutes=70,
        last_session_at=TUESDAY_EVENING - timedelta(days=6),
        sessions_last_7_days=1,
        sessions_previous_7_days=1,
    )


def _delivery(notification_type: str, hours_ago: float):
    return SimpleNamespace(notification_type=notification_type, sent_at=TUESDAY_EVENING - timedelta(hours=hours_ago))


def _context(**overrides) -> EngagementContext:
    values = dict(
        user_id=1,
        zone=ZURICH,
        profile=_tuesday_producer(),
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


def _spec_example(**overrides) -> EngagementContext:
    """Spec §34: Tuesday 19:10, 6-day streak, a friend just passed them, social converts best."""
    values = dict(
        streak_days=6,
        streak_at_risk=True,
        leaderboard=LeaderboardStanding(rank=2, previous_rank=1, session_count=1, friend_ahead_name="Leo"),
        motivation={NotificationCategory.SOCIAL: 0.44, NotificationCategory.STREAK: 0.18},
        recent_deliveries=(_delivery("rank_close", hours_ago=26),),
    )
    values.update(overrides)
    return _context(**values)


def test_the_spec_example_sends_the_social_push_over_the_streak_push():
    decision = decide(_spec_example(), default_preferences(1), TUESDAY_EVENING)

    assert decision.should_send
    assert decision.type == CandidateType.SOCIAL_OVERTAKEN
    assert decision.variables == {"friendName": "Leo"}
    scores = {scored.candidate.type: scored.total for scored in decision.candidates}
    assert scores[CandidateType.SOCIAL_OVERTAKEN] > scores[CandidateType.STREAK_AT_RISK] >= 45


def test_only_one_candidate_is_chosen():
    decision = decide(_spec_example(), default_preferences(1), TUESDAY_EVENING)

    assert len(decision.candidates) == 2
    assert decision.chosen is decision.candidates[0]


def test_nothing_is_sent_when_every_candidate_scores_below_the_threshold():
    context = _context(current_level=12, xp_to_next_level=40, fatigue_score=60)

    decision = decide(context, default_preferences(1), TUESDAY_EVENING)

    assert not decision.should_send
    assert decision.candidates[0].total < 25
    assert "below" in decision.reason


def test_a_limit_blocks_even_a_high_score():
    context = _spec_example(recent_deliveries=(_delivery("challenge_close", hours_ago=2),))

    decision = decide(context, default_preferences(1), TUESDAY_EVENING)

    assert not decision.should_send
    assert {scored.limit for scored in decision.candidates} == {LimitReason.MIN_SPACING}


def test_a_muted_category_hands_the_turn_to_the_next_candidate():
    prefs = default_preferences(1)
    prefs.social_enabled = False

    decision = decide(_spec_example(), prefs, TUESDAY_EVENING)

    assert decision.type == CandidateType.STREAK_AT_RISK


def test_nothing_is_sent_with_smart_notifications_off():
    prefs = default_preferences(1)
    prefs.smart_enabled = False

    assert not decide(_spec_example(), prefs, TUESDAY_EVENING).should_send


def test_no_trigger_means_no_push():
    decision = decide(_context(), default_preferences(1), TUESDAY_EVENING)

    assert not decision.should_send
    assert decision.candidates == ()
    assert decision.reason == "no trigger applies"


def test_two_ignored_pushes_pause_smart_pushes_for_a_day():
    context = _spec_example(ignored_streak=2, recent_deliveries=(_delivery("rank_close", hours_ago=20),))

    decision = decide(context, default_preferences(1), TUESDAY_EVENING)

    assert not decision.should_send
    assert {scored.limit for scored in decision.candidates} == {LimitReason.FATIGUE_PAUSE}


def test_the_pause_ends_after_its_time():
    context = _spec_example(ignored_streak=2, recent_deliveries=(_delivery("rank_close", hours_ago=25),))

    assert decide(context, default_preferences(1), TUESDAY_EVENING).should_send


def test_after_four_ignored_pushes_only_high_priority_goes_out():
    rank_only = _context(current_level=12, xp_to_next_level=40, ignored_streak=4)
    at_send_moment = TUESDAY_EVENING.replace(hour=18, minute=40)

    decision = decide(rank_only, default_preferences(1), at_send_moment)

    assert 25 <= decision.candidates[0].total < 70
    assert not decision.should_send
    long_quiet = _spec_example(ignored_streak=4, recent_deliveries=(_delivery("rank_close", hours_ago=50),))
    assert decide(long_quiet, default_preferences(1), TUESDAY_EVENING).should_send


def test_a_learned_hour_replaces_the_slot_before_the_window():
    context = _context(current_level=12, xp_to_next_level=10, preferred_notification_hour=19)

    assert decide(context, default_preferences(1), TUESDAY_EVENING).should_send
    decision = decide(context, default_preferences(1), TUESDAY_EVENING.replace(hour=18, minute=40))
    assert not decision.should_send
    assert decision.scheduled_at == datetime(2026, 6, 9, 19, 0, tzinfo=ZURICH)


def test_a_push_that_can_wait_waits_for_the_send_moment():
    context = _context(current_level=12, xp_to_next_level=10)

    decision = decide(context, default_preferences(1), TUESDAY_EVENING)

    assert not decision.should_send
    assert decision.scheduled_at == datetime(2026, 6, 16, 18, 35, tzinfo=ZURICH)


def test_a_push_that_can_wait_goes_out_at_the_send_moment():
    context = _context(current_level=12, xp_to_next_level=10)

    decision = decide(context, default_preferences(1), TUESDAY_EVENING.replace(hour=18, minute=40))

    assert decision.type == CandidateType.RANK_CLOSE
    assert decision.should_send
