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
