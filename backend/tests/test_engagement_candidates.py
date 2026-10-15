from dataclasses import replace
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.services.engagement.candidates import (
    CandidateType,
    challenge_candidate,
    generate_candidates,
    rank_candidate,
    reengagement_candidate,
    social_candidate,
    streak_candidate,
)
from app.services.engagement.context import (
    ChallengeStanding,
    EngagementContext,
    FriendSession,
    LeaderboardStanding,
)
from app.services.engagement.preferences import NotificationCategory
from app.services.engagement.profile import STAGE_ESTABLISHED, BehaviorProfile

ZURICH = ZoneInfo("Europe/Zurich")
NOW = datetime(2026, 6, 10, 19, 0, tzinfo=ZURICH)  # Wednesday evening


def _profile(**overrides) -> BehaviorProfile:
    values = dict(
        total_sessions=20,
        stage=STAGE_ESTABLISHED,
        session_hour_histogram=[0] * 20 + [20, 0, 0, 0],
        weekday_histogram=[3] * 7,
        avg_sessions_per_week=4,
        avg_session_duration_minutes=60,
        last_session_at=NOW - timedelta(days=1),
        sessions_last_7_days=4,
        sessions_previous_7_days=4,
    )
    values.update(overrides)
    return BehaviorProfile(**values)


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


# --- streak -----------------------------------------------------------------------------------


def test_a_streak_at_risk_in_the_evening_is_a_candidate():
    candidate = streak_candidate(_context(streak_days=12, streak_at_risk=True), NOW)

    assert candidate.type == CandidateType.STREAK_AT_RISK
    assert candidate.category == NotificationCategory.STREAK
    assert candidate.variables == {"streakDays": "12", "minutesToGoal": "300"}
    assert candidate.path == "/(tabs)/dashboard"


def test_no_streak_candidate_once_todays_session_is_in():
    assert streak_candidate(_context(streak_days=12, streak_at_risk=False), NOW) is None


def test_no_streak_candidate_when_the_streak_is_already_lost():
    assert streak_candidate(_context(streak_days=0, streak_at_risk=False), NOW) is None


def test_no_streak_candidate_in_the_morning():
    morning = NOW.replace(hour=9)

    assert streak_candidate(_context(streak_days=12, streak_at_risk=True), morning) is None


def test_the_streak_candidate_grows_more_urgent_towards_midnight():
    context = _context(streak_days=12, streak_at_risk=True)

    early = streak_candidate(context, NOW.replace(hour=18))
    late = streak_candidate(context, NOW.replace(hour=23))

    assert late.base_score > early.base_score


# --- re-engagement ----------------------------------------------------------------------------


def test_a_producer_well_below_their_usual_pace_gets_a_gentle_nudge():
    profile = _profile(last_session_at=NOW - timedelta(days=5), sessions_last_7_days=0)

    candidate = reengagement_candidate(_context(profile=profile), NOW)

    assert candidate.type == CandidateType.REENGAGEMENT
    assert candidate.category == NotificationCategory.REENGAGEMENT
    assert candidate.variables == {"daysInactive": "5"}


def test_no_reengagement_while_the_producer_keeps_their_pace():
    assert reengagement_candidate(_context(), NOW) is None


def test_no_reengagement_for_a_producer_without_sessions():
    profile = _profile(total_sessions=0, last_session_at=None, sessions_last_7_days=0, avg_sessions_per_week=0)

    assert reengagement_candidate(_context(profile=profile), NOW) is None


def test_reengagement_for_a_producer_inactive_for_months():
    months_ago = NOW.astimezone(timezone.utc) - timedelta(days=120)
    profile = _profile(last_session_at=months_ago, sessions_last_7_days=0, avg_sessions_per_week=0)

    candidate = reengagement_candidate(_context(profile=profile), NOW)

    assert candidate.variables == {"daysInactive": "120"}


# --- rank -------------------------------------------------------------------------------------


def test_close_to_the_next_rank_when_one_usual_session_would_get_there():
    candidate = rank_candidate(_context(current_level=12, xp_to_next_level=20), NOW)

    assert candidate.type == CandidateType.RANK_CLOSE
    assert candidate.variables == {"xpRemaining": "20", "rankName": "Stereo Architect"}


def test_no_rank_candidate_when_the_next_rank_is_far_away():
    assert rank_candidate(_context(current_level=12, xp_to_next_level=400), NOW) is None


def test_no_rank_candidate_at_the_top_rank():
    assert rank_candidate(_context(current_level=20, xp_to_next_level=10), NOW) is None


# --- challenge --------------------------------------------------------------------------------


def _challenge(**overrides) -> ChallengeStanding:
    values = dict(
        challenge_id=7,
        title="June duel",
        sessions_remaining=4,
        ends_at=NOW + timedelta(days=5),
        last_progress_at=NOW - timedelta(days=1),
    )
    values.update(overrides)
    return ChallengeStanding(**values)


def test_a_challenge_close_to_done_is_a_candidate():
    candidate = challenge_candidate(_context(challenges=(_challenge(sessions_remaining=2),)), NOW)

    assert candidate.type == CandidateType.CHALLENGE_CLOSE
    assert candidate.variables == {"challengeName": "June duel", "sessionsRemaining": "2"}
    assert candidate.path == "/challenge/7"


def test_a_challenge_ending_soon_is_a_candidate():
    challenge = _challenge(ends_at=NOW + timedelta(hours=30))

    assert challenge_candidate(_context(challenges=(challenge,)), NOW).type == CandidateType.CHALLENGE_DEADLINE


def test_a_stalled_challenge_is_a_candidate():
    challenge = _challenge(last_progress_at=NOW - timedelta(days=4))

    assert challenge_candidate(_context(challenges=(challenge,)), NOW).type == CandidateType.CHALLENGE_STALLED


def test_a_challenge_already_won_is_not_a_candidate():
    challenge = _challenge(sessions_remaining=0, ends_at=NOW + timedelta(hours=5))

    assert challenge_candidate(_context(challenges=(challenge,)), NOW) is None


def test_a_challenge_on_track_is_not_a_candidate():
    assert challenge_candidate(_context(challenges=(_challenge(),)), NOW) is None


def test_the_most_pressing_challenge_wins():
    stalled = _challenge(challenge_id=1, last_progress_at=NOW - timedelta(days=4))
    deadline = _challenge(challenge_id=2, ends_at=NOW + timedelta(hours=10))

    assert challenge_candidate(_context(challenges=(stalled, deadline)), NOW).path == "/challenge/2"


# --- social -----------------------------------------------------------------------------------


def test_a_friend_who_just_wrapped_a_session_is_a_candidate():
    friend = FriendSession(friend_id=5, friend_name="Mira", ended_at=NOW - timedelta(minutes=20), duration_minutes=45)

    candidate = social_candidate(_context(friend_sessions=(friend,)), NOW)

    assert candidate.type == CandidateType.SOCIAL_FRIEND_SESSION
    assert candidate.category == NotificationCategory.SOCIAL
    assert candidate.variables == {"friendName": "Mira", "durationMinutes": "45"}
    assert candidate.base_score == 55


def test_a_short_session_from_someone_you_are_not_chasing_counts_for_less():
    friend = FriendSession(friend_id=5, friend_name="Mira", ended_at=NOW - timedelta(minutes=20), duration_minutes=15)
    rival = FriendSession(friend_id=6, friend_name="Jonas", ended_at=NOW - timedelta(minutes=10), duration_minutes=50)
    standing = LeaderboardStanding(rank=2, previous_rank=2, session_count=3, friend_ahead_name="Jonas")

    casual = social_candidate(_context(friend_sessions=(friend,)), NOW)
    relevant = social_candidate(_context(friend_sessions=(rival,), leaderboard=standing), NOW)

    assert casual.base_score < relevant.base_score


def test_a_friend_overtaking_you_beats_a_friend_session():
    friend = FriendSession(friend_id=5, friend_name="Mira", ended_at=NOW - timedelta(minutes=20), duration_minutes=45)
    standing = LeaderboardStanding(rank=3, previous_rank=2, session_count=3, friend_ahead_name="Jonas")

    candidate = social_candidate(_context(friend_sessions=(friend,), leaderboard=standing), NOW)

    assert candidate.type == CandidateType.SOCIAL_OVERTAKEN
    assert candidate.variables == {"friendName": "Jonas"}


def test_no_overtake_when_your_rank_held():
    standing = LeaderboardStanding(rank=2, previous_rank=2, session_count=3, friend_ahead_name="Jonas")

    assert social_candidate(_context(leaderboard=standing), NOW) is None


def test_no_social_candidate_without_friend_activity():
    assert social_candidate(_context(), NOW) is None


# --- all together -----------------------------------------------------------------------------


def test_every_matching_trigger_becomes_its_own_candidate():
    friend = FriendSession(friend_id=5, friend_name="Mira", ended_at=NOW - timedelta(minutes=20), duration_minutes=45)
    context = _context(
        streak_days=12,
        streak_at_risk=True,
        current_level=12,
        xp_to_next_level=20,
        friend_sessions=(friend,),
        challenges=(_challenge(sessions_remaining=1),),
    )

    types = {candidate.type for candidate in generate_candidates(context, NOW)}

    assert types == {
        CandidateType.STREAK_AT_RISK,
        CandidateType.RANK_CLOSE,
        CandidateType.CHALLENGE_CLOSE,
        CandidateType.SOCIAL_FRIEND_SESSION,
    }


def test_candidates_carry_copy_from_the_central_templates():
    candidate = streak_candidate(_context(streak_days=12, streak_at_risk=True), NOW)

    assert "12-day streak" in candidate.body
    assert candidate.title


def test_generators_judge_time_in_the_producers_zone():
    utc_now = NOW.astimezone(timezone.utc)

    assert streak_candidate(_context(streak_days=3, streak_at_risk=True), utc_now).variables["minutesToGoal"] == "300"
    assert streak_candidate(replace(_context(streak_days=3, streak_at_risk=True), zone=timezone.utc), utc_now) is None
