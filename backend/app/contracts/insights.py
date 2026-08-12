from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.contracts.sessions import InsightItemPublic


class StreakPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    current_streak: int
    longest_streak: int
    last_session_date: datetime | None


class StreakOverviewPublic(BaseModel):
    current_streak: int
    longest_streak: int
    last_7_day_states: list[str]
    last_7_day_labels: list[str]
    next_milestone_at: int | None
    next_milestone_title: str | None
    days_to_next_milestone: int | None
    freezes_remaining: int
    can_use_freeze: bool
    streak_at_risk: bool
    tagline: str


class StreakFreezeResult(BaseModel):
    success: bool
    message: str
    current_streak: int
    freezes_remaining: int


class StreakRunPublic(BaseModel):
    start_date: str
    end_date: str
    length_days: int


class StreakMilestoneItem(BaseModel):
    days: int
    title: str
    unlocked: bool


class StreakMilestonesPublic(BaseModel):
    milestones: list[StreakMilestoneItem]
    longest_streak_days: int


class PersonalRecordItem(BaseModel):
    key: str
    label: str
    value: str
    context: str | None = None
    occurred_at: str | None = None


class PersonalRecordsPublic(BaseModel):
    records: list[PersonalRecordItem]


class HeatmapDayPublic(BaseModel):
    date: str
    seconds: int
    intensity: int


class HeatmapPublic(BaseModel):
    days: list[HeatmapDayPublic]


class ProductivityInsightsPublic(BaseModel):
    best_hour_start: int | None = None
    best_weekday: str | None = None
    best_weekday_index: int | None = None
    tips: list[str] = Field(default_factory=list)
    tip_items: list[InsightItemPublic] = Field(default_factory=list)


class StatsInsightsPublic(BaseModel):
    productivity: ProductivityInsightsPublic
    weekly_goal_sessions: int | None = None
    weekly_goal_target: int | None = None
    weekly_goal_met: bool | None = None


class SessionTimelineSegmentPublic(BaseModel):
    kind: str
    seconds: int


class RelatedSessionPublic(BaseModel):
    id: int
    session_type: str
    duration_seconds: int | None
    started_at: datetime


class SessionDetailInsightsPublic(BaseModel):
    impact_lines: list[str] = Field(default_factory=list)
    impact_items: list[InsightItemPublic] = Field(default_factory=list)
    focus_score: int
    focus_label: str = ""
    focus_tier: str = "solid"
    focus_percentile: int | None
    focus_user_average: int | None = None
    active_seconds: int
    paused_seconds: int
    effective_rate_percent: float
    timeline: list[SessionTimelineSegmentPublic]
    productivity_insights: list[str] = Field(default_factory=list)
    productivity_items: list[InsightItemPublic] = Field(default_factory=list)
    related_sessions: list[RelatedSessionPublic]
