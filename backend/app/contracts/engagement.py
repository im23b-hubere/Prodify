"""Development-only view of why the engagement engine would or would not send right now."""

from datetime import datetime

from pydantic import BaseModel


class EngagementProfileDebug(BaseModel):
    stage: int
    total_sessions: int
    avg_sessions_per_week: float
    avg_session_duration_minutes: float
    last_session_duration_minutes: float
    sessions_last_7_days: int
    sessions_previous_7_days: int
    days_since_last_session: int | None
    preferred_hours: list[int]


class ProductionWindowDebug(BaseModel):
    weekdays: list[int]
    start_hour: int
    end_hour: int
    is_default: bool


class LastDeliveryDebug(BaseModel):
    notification_type: str
    sent_at: datetime
    outcome: str
    candidate_score: int | None
    reason: str | None


class EngagementCandidateDebug(BaseModel):
    type: str
    category: str
    title: str
    body: str
    reason: str
    total: int
    priority: str
    parts: dict[str, int]
    verdict: str
    is_eligible: bool


class EngagementDecisionDebug(BaseModel):
    should_send: bool
    chosen_type: str | None
    score: int
    reason: str
    scheduled_at: datetime | None


class EngagementPrimaryMetrics(BaseModel):
    notification_conversion_rate: float
    sessions_per_active_user: float
    weekly_active_producers: int
    retention_d1: float
    retention_d7: float
    retention_d30: float


class EngagementSecondaryMetrics(BaseModel):
    notification_open_rate: float
    avg_session_duration_minutes: float
    streak_retention_rate: float
    challenge_completion_rate: float
    social_conversion_rate: float


class EngagementNegativeMetrics(BaseModel):
    smart_opt_out_rate: float
    push_token_inactive_rate: float
    notifications_ignored: int
    notification_ignore_rate: float
    session_abandon_rate: float


class EngagementMetricsPublic(BaseModel):
    """Whether the engine helps or hurts; rates are 0.0–1.0 over the dashboard window unless named otherwise."""

    smart_notifications_delivered: int
    primary: EngagementPrimaryMetrics
    secondary: EngagementSecondaryMetrics
    negative: EngagementNegativeMetrics


class EngagementDebugPublic(BaseModel):
    evaluated_at: datetime
    profile: EngagementProfileDebug
    production_window: ProductionWindowDebug
    preferred_notification_hour: int | None
    segment: str | None
    return_probability_24h: float | None
    previous_return_probability: float | None
    fatigue_score: float
    ignored_streak: int
    motivation: dict[str, float]
    last_delivery: LastDeliveryDebug | None
    candidates: list[EngagementCandidateDebug]
    decision: EngagementDecisionDebug
