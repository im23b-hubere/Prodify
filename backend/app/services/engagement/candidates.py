"""
Pure generators that turn one producer's `EngagementContext` into notification candidates.
Each generator returns at most one candidate; choosing between them is the scorer's job.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import StrEnum

from app.services import push_templates
from app.services.engagement.context import ChallengeStanding, EngagementContext
from app.services.engagement.preferences import NotificationCategory
from app.services.progression_service import XP_LEVEL_CATALOG_MAX, xp_for_completed_session
from app.services.push_links import DASHBOARD_PATH, FRIENDS_PATH, challenge_path
from app.timeutil import as_utc_aware, in_zone

STREAK_EVENING_START_HOUR = 18
REENGAGEMENT_MIN_DAYS = 3
RETURN_DROP_THRESHOLD = 0.3
TYPICAL_SESSION_FLOOR_MINUTES = 30
CHALLENGE_CLOSE_SESSIONS = 2
CHALLENGE_DEADLINE_WINDOW = timedelta(hours=48)
CHALLENGE_STALL_AFTER = timedelta(days=3)
FRIEND_SESSION_MIN_MINUTES = 15
_MINUTES_PER_DAY = 24 * 60


class CandidateType(StrEnum):
    STREAK_AT_RISK = "streak_at_risk"
    REENGAGEMENT = "reengagement"
    RANK_CLOSE = "rank_close"
    CHALLENGE_CLOSE = "challenge_close"
    CHALLENGE_DEADLINE = "challenge_deadline"
    CHALLENGE_STALLED = "challenge_stalled"
    SOCIAL_FRIEND_SESSION = "social_friend_session"
    SOCIAL_OVERTAKEN = "social_overtaken"


@dataclass(frozen=True)
class Candidate:
    """
    A push the engine could send. `base_score` (0–100) is the trigger's own urgency.
    Time-sensitive candidates lose their point if they wait for the producer's send moment.
    """

    type: CandidateType
    category: NotificationCategory
    base_score: int
    title: str
    body: str
    path: str
    reason: str
    variables: dict[str, str] = field(default_factory=dict)
    is_time_sensitive: bool = False


def generate_candidates(context: EngagementContext, now: datetime) -> list[Candidate]:
    generators = (streak_candidate, reengagement_candidate, rank_candidate, challenge_candidate, social_candidate)
    return [candidate for generate in generators if (candidate := generate(context, now)) is not None]


def streak_candidate(context: EngagementContext, now: datetime) -> Candidate | None:
    if context.streak_days <= 0 or not context.streak_at_risk:
        return None
    local = in_zone(now, context.zone)
    if local.hour < STREAK_EVENING_START_HOUR:
        return None
    minutes_to_goal = _MINUTES_PER_DAY - (local.hour * 60 + local.minute)
    evening_minutes = _MINUTES_PER_DAY - STREAK_EVENING_START_HOUR * 60
    urgency = 30 * (1 - minutes_to_goal / evening_minutes)
    streak_weight = min(context.streak_days, 30) / 3
    title, body = push_templates.streak_at_risk(context.streak_days, minutes_to_goal)
    return Candidate(
        type=CandidateType.STREAK_AT_RISK,
        category=NotificationCategory.STREAK,
        base_score=round(40 + urgency + streak_weight),
        title=title,
        body=body,
        path=DASHBOARD_PATH,
        reason=f"{context.streak_days}-day streak at risk, {minutes_to_goal} min left today",
        variables={"streakDays": str(context.streak_days), "minutesToGoal": str(minutes_to_goal)},
        is_time_sensitive=True,
    )


def reengagement_candidate(context: EngagementContext, now: datetime) -> Candidate | None:
    return _inactivity_candidate(context, now) or _slipping_candidate(context)


def _inactivity_candidate(context: EngagementContext, now: datetime) -> Candidate | None:
    profile = context.profile
    days_inactive = profile.days_since_last_session(now)
    if days_inactive is None or days_inactive < REENGAGEMENT_MIN_DAYS:
        return None
    if profile.sessions_last_7_days > profile.avg_sessions_per_week / 2:
        return None
    title, body = push_templates.reengagement(days_inactive)
    return Candidate(
        type=CandidateType.REENGAGEMENT,
        category=NotificationCategory.REENGAGEMENT,
        base_score=30 + min(days_inactive, 10) * 2,
        title=title,
        body=body,
        path=DASHBOARD_PATH,
        reason=f"no session for {days_inactive} days, below the usual {profile.avg_sessions_per_week:g}/week",
        variables={"daysInactive": str(days_inactive)},
    )


def _slipping_candidate(context: EngagementContext) -> Candidate | None:
    if context.return_probability_drop < RETURN_DROP_THRESHOLD:
        return None
    title, body = push_templates.return_slipping()
    return Candidate(
        type=CandidateType.REENGAGEMENT,
        category=NotificationCategory.REENGAGEMENT,
        base_score=35,
        title=title,
        body=body,
        path=DASHBOARD_PATH,
        reason=(
            f"return probability fell from {context.previous_return_probability:.0%} "
            f"to {context.return_probability:.0%} since yesterday"
        ),
    )


def rank_candidate(context: EngagementContext, now: datetime) -> Candidate | None:
    if context.current_level >= XP_LEVEL_CATALOG_MAX:
        return None
    typical_minutes = max(context.profile.avg_session_duration_minutes, TYPICAL_SESSION_FLOOR_MINUTES)
    typical_session_xp = xp_for_completed_session(int(typical_minutes * 60))
    xp_remaining = context.xp_to_next_level
    if xp_remaining <= 0 or xp_remaining > typical_session_xp:
        return None
    rank_name = push_templates.RANK_NAMES.get(context.current_level + 1, f"Level {context.current_level + 1}")
    title, body = push_templates.rank_close(xp_remaining, rank_name)
    return Candidate(
        type=CandidateType.RANK_CLOSE,
        category=NotificationCategory.RANK,
        base_score=round(30 + 20 * (1 - xp_remaining / typical_session_xp)),
        title=title,
        body=body,
        path=DASHBOARD_PATH,
        reason=f"{xp_remaining} XP to {rank_name}, a usual session earns {typical_session_xp}",
        variables={"xpRemaining": str(xp_remaining), "rankName": rank_name},
    )


def challenge_candidate(context: EngagementContext, now: datetime) -> Candidate | None:
    candidates = [
        candidate for challenge in context.challenges if (candidate := _challenge_candidate(challenge, now))
    ]
    return max(candidates, key=lambda candidate: candidate.base_score, default=None)


@dataclass(frozen=True)
class _ChallengeTrigger:
    type: CandidateType
    base_score: int
    copy: tuple[str, str]
    reason: str


def _challenge_candidate(challenge: ChallengeStanding, now: datetime) -> Candidate | None:
    trigger = _challenge_trigger(challenge, now)
    if trigger is None:
        return None
    title, body = trigger.copy
    return Candidate(
        type=trigger.type,
        category=NotificationCategory.CHALLENGE,
        base_score=trigger.base_score,
        title=title,
        body=body,
        path=challenge_path(challenge.challenge_id),
        reason=trigger.reason,
        variables={"challengeName": challenge.title, "sessionsRemaining": str(challenge.sessions_remaining)},
        is_time_sensitive=trigger.type == CandidateType.CHALLENGE_DEADLINE,
    )


def _challenge_trigger(challenge: ChallengeStanding, now: datetime) -> _ChallengeTrigger | None:
    remaining = challenge.sessions_remaining
    time_left = as_utc_aware(challenge.ends_at) - as_utc_aware(now)
    if remaining <= 0 or time_left <= timedelta(0):
        return None
    if time_left <= CHALLENGE_DEADLINE_WINDOW:
        hours_left = int(time_left.total_seconds() // 3600)
        return _ChallengeTrigger(
            CandidateType.CHALLENGE_DEADLINE,
            60,
            push_templates.challenge_deadline(challenge.title, remaining),
            f"challenge ends in {hours_left}h with {remaining} sessions to go",
        )
    if remaining <= CHALLENGE_CLOSE_SESSIONS:
        return _ChallengeTrigger(
            CandidateType.CHALLENGE_CLOSE,
            55,
            push_templates.challenge_close(challenge.title, remaining),
            f"{remaining} sessions from finishing the challenge",
        )
    if as_utc_aware(now) - as_utc_aware(challenge.last_progress_at) >= CHALLENGE_STALL_AFTER:
        return _ChallengeTrigger(
            CandidateType.CHALLENGE_STALLED,
            40,
            push_templates.challenge_stalled(challenge.title),
            "no challenge progress for 3+ days",
        )
    return None


def social_candidate(context: EngagementContext, now: datetime) -> Candidate | None:
    return _overtaken_candidate(context) or _friend_session_candidate(context)


def _overtaken_candidate(context: EngagementContext) -> Candidate | None:
    standing = context.leaderboard
    if standing is None or standing.previous_rank is None or standing.friend_ahead_name is None:
        return None
    if standing.rank <= standing.previous_rank:
        return None
    title, body = push_templates.friend_overtook(standing.friend_ahead_name)
    return Candidate(
        type=CandidateType.SOCIAL_OVERTAKEN,
        category=NotificationCategory.SOCIAL,
        base_score=65,
        title=title,
        body=body,
        path=FRIENDS_PATH,
        reason=f"dropped from #{standing.previous_rank} to #{standing.rank} on the friend leaderboard",
        variables={"friendName": standing.friend_ahead_name},
        is_time_sensitive=True,
    )


def _friend_session_candidate(context: EngagementContext) -> Candidate | None:
    session = next(
        (session for session in context.friend_sessions if session.duration_minutes >= FRIEND_SESSION_MIN_MINUTES),
        None,
    )
    if session is None:
        return None
    title, body = push_templates.friend_finished_session(session.friend_name, session.duration_minutes)
    return Candidate(
        type=CandidateType.SOCIAL_FRIEND_SESSION,
        category=NotificationCategory.SOCIAL,
        base_score=50,
        title=title,
        body=body,
        path=FRIENDS_PATH,
        reason=f"a friend just finished a {session.duration_minutes} min session",
        variables={"friendName": session.friend_name, "durationMinutes": str(session.duration_minutes)},
        is_time_sensitive=True,
    )
