from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SeedScreenshotAccountBody(BaseModel):
    main_email: str = Field(default="eric.huber.ch@gmail.com", max_length=255)
    main_username: str = Field(default="erix", min_length=2, max_length=64)
    main_password: str = Field(default="demo123456", min_length=8, max_length=128)
    friend_password: str = Field(default="demo123456", min_length=8, max_length=128)
    days_back: int = Field(default=84, ge=14, le=365)
    current_streak: int = Field(default=52, ge=1, le=999)
    longest_streak: int = Field(default=71, ge=1, le=999)
    main_level: int = Field(default=24, ge=1, le=99)


class ProgressionPublic(BaseModel):
    xp_total: int
    current_level: int
    xp_to_next_level: int
    progress_percent: float
    decay_grace_days: int = 2
    decay_xp_per_day: int = 12


class ProgressionLevelPublic(BaseModel):
    level: int
    xp_start: int
    xp_end_exclusive: int
    xp_span: int


class WeeklyReviewPublic(BaseModel):
    week_start: str
    week_end: str
    total_sessions: int
    total_seconds: int
    insights: list[str] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    ai_feedback: str
    share_image_url: str | None = None


class GoalForecastPublic(BaseModel):
    week_start: str
    target_sessions: int
    completed_sessions: int
    remaining_sessions: int
    days_left: int
    required_sessions_per_day: float
    risk_level: Literal["on_track", "at_risk", "off_track"]
    warning_message: str


class OutputMetricsPublic(BaseModel):
    tracks_finished_30d: int
    avg_completion_time_days: float
    release_consistency: float
    productivity_trend: Literal["up", "down", "stable"]
    vs_previous_month: float
    days_using: int
    completed_tracks: int
    consistency_improvement: float
    output_increase: float
    baseline_tracks_30d: int


class KpiSummaryPublic(BaseModel):
    d1_retention_rate: float
    d7_retention_rate: float
    sessions_per_week_per_user: float
    trial_start_rate: float
    trial_to_paid_conversion_rate: float
    invites_sent: int
    challenge_participation: int


class KpiTrendPointPublic(BaseModel):
    date: str
    sessions_completed: int
    active_users: int
    growth_events: int


class KpiDashboardPublic(BaseModel):
    generated_at: datetime
    window_days: int
    totals: KpiSummaryPublic
    users_total: int
    users_new_7d: int
    sessions_completed_7d: int
    active_users_7d: int
    growth_events_7d: int
    trial_active_total: int
    premium_total: int
    push_tokens_active: int
    push_tokens_inactive: int
    trend: list[KpiTrendPointPublic] = Field(default_factory=list)
