"""
How likely a producer starts a session within the next 24 hours, from 0.0 to 1.0.

A hand-weighted logistic function: every feature adds `weight × value` to a log-odds sum.
`ReturnWeights` is the seam where a trained model's coefficients can replace these.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime

from app.services.engagement.profile import BehaviorProfile

# A producer without any session counts as a week away, not as never coming back.
NEVER_SESSIONED_DAYS = 7
_MAX_DAYS_AWAY = 30
_MAX_WEEKLY_PACE = 14
_MAX_MOMENTUM = 7
_MAX_SESSION_MINUTES = 120
_NEUTRAL_RESPONSE_RATE = 0.25
_EVEN_WEEKDAY_SHARE = 1 / 7


@dataclass(frozen=True)
class ReturnFeatures:
    days_since_last_session: int | None
    sessions_last_7_days: int
    sessions_previous_7_days: int
    avg_sessions_per_week: float
    usual_hour_still_ahead_today: bool
    weekday_share: float
    has_streak: bool
    streak_at_risk: bool
    has_active_challenge: bool
    has_friend_activity: bool
    notification_response_rate: float | None
    last_session_duration_minutes: float


@dataclass(frozen=True)
class ReturnWeights:
    bias: float = -1.0
    per_day_away: float = -0.35
    per_weekly_session: float = 0.35
    per_session_momentum: float = 0.15
    usual_hour_ahead: float = 0.4
    weekday_affinity: float = 2.0
    streak: float = 0.6
    streak_at_risk: float = 0.3
    active_challenge: float = 0.3
    friend_activity: float = 0.2
    response_rate: float = 1.0
    per_session_minute: float = 0.005


DEFAULT_RETURN_WEIGHTS = ReturnWeights()


def return_features(
    profile: BehaviorProfile,
    local_now: datetime,
    *,
    streak_days: int,
    streak_at_risk: bool,
    has_active_challenge: bool,
    has_friend_activity: bool,
    notification_response_rate: float | None,
) -> ReturnFeatures:
    weekday_total = sum(profile.weekday_histogram)
    return ReturnFeatures(
        days_since_last_session=profile.days_since_last_session(local_now),
        sessions_last_7_days=profile.sessions_last_7_days,
        sessions_previous_7_days=profile.sessions_previous_7_days,
        avg_sessions_per_week=profile.avg_sessions_per_week,
        usual_hour_still_ahead_today=any(hour >= local_now.hour for hour in profile.preferred_hours()),
        weekday_share=profile.weekday_histogram[local_now.weekday()] / weekday_total
        if weekday_total
        else _EVEN_WEEKDAY_SHARE,
        has_streak=streak_days > 0,
        streak_at_risk=streak_at_risk,
        has_active_challenge=has_active_challenge,
        has_friend_activity=has_friend_activity,
        notification_response_rate=notification_response_rate,
        last_session_duration_minutes=profile.last_session_duration_minutes,
    )


def return_probability(features: ReturnFeatures, weights: ReturnWeights = DEFAULT_RETURN_WEIGHTS) -> float:
    days_away = features.days_since_last_session
    days_away = NEVER_SESSIONED_DAYS if days_away is None else min(days_away, _MAX_DAYS_AWAY)
    momentum = features.sessions_last_7_days - features.sessions_previous_7_days
    response_rate = features.notification_response_rate
    log_odds = (
        weights.bias
        + weights.per_day_away * days_away
        + weights.per_weekly_session * min(features.avg_sessions_per_week, _MAX_WEEKLY_PACE)
        + weights.per_session_momentum * max(-_MAX_MOMENTUM, min(momentum, _MAX_MOMENTUM))
        + weights.usual_hour_ahead * features.usual_hour_still_ahead_today
        + weights.weekday_affinity * (features.weekday_share - _EVEN_WEEKDAY_SHARE)
        + weights.streak * features.has_streak
        + weights.streak_at_risk * (features.has_streak and features.streak_at_risk)
        + weights.active_challenge * features.has_active_challenge
        + weights.friend_activity * features.has_friend_activity
        + weights.response_rate * ((response_rate if response_rate is not None else _NEUTRAL_RESPONSE_RATE) - _NEUTRAL_RESPONSE_RATE)
        + weights.per_session_minute * min(features.last_session_duration_minutes, _MAX_SESSION_MINUTES)
    )
    return 1 / (1 + math.exp(-log_odds))
