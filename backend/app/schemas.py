import json
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import FriendshipStatus, SessionType


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    username: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SessionQuickStart(BaseModel):
    session_type: SessionType = SessionType.beat_making


class SessionStart(BaseModel):
    session_type: SessionType
    notes: str | None = Field(default=None, max_length=200)
    mood_level: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, v: object) -> list[str] | None:
        if v is None:
            return None
        if not isinstance(v, list):
            raise ValueError("tags must be a list of strings")
        out: list[str] = []
        for item in v[:20]:
            s = str(item).strip()
            if not s:
                continue
            if len(s) > 32:
                raise ValueError("each tag must be at most 32 characters")
            out.append(s)
        return out or None


class SessionStop(BaseModel):
    session_id: int


class SessionUpdate(BaseModel):
    session_type: SessionType | None = None
    notes: str | None = Field(default=None, max_length=2000)
    mood_level: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, v: object) -> list[str] | None:
        if v is None:
            return None
        if not isinstance(v, list):
            raise ValueError("tags must be a list of strings")
        out: list[str] = []
        for item in v[:20]:
            s = str(item).strip()
            if not s:
                continue
            if len(s) > 32:
                raise ValueError("each tag must be at most 32 characters")
            out.append(s)
        return out or None


class SessionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    started_at: datetime
    stopped_at: datetime | None
    duration_seconds: int | None
    session_type: str
    notes: str | None
    mood_level: int | None = None
    tags: list[str] | None = None
    paused_duration_seconds: int = 0
    pause_started_at: datetime | None = None
    focus_score: int | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags_json(cls, v: object) -> list[str] | None:
        if v is None or v == "":
            return None
        if isinstance(v, list):
            return [str(x) for x in v]
        if isinstance(v, str):
            try:
                data = json.loads(v)
                if isinstance(data, list):
                    return [str(x) for x in data]
            except json.JSONDecodeError:
                return None
        return None


class SessionStatsSummary(BaseModel):
    total_seconds: int
    total_sessions: int
    best_streak_days: int
    avg_session_seconds: int
    current_streak_days: int = 0
    hours_delta_vs_prior_period: float | None = None


class SessionStatsTrendPoint(BaseModel):
    label: str
    sessions: int
    seconds: int


class SessionStatsTypeBreakdownItem(BaseModel):
    session_type: str
    sessions: int
    percent: float


class SessionStatsPublic(BaseModel):
    period: str
    summary: SessionStatsSummary
    trend: list[SessionStatsTrendPoint]
    breakdown: list[SessionStatsTypeBreakdownItem]
    recent_sessions: list[SessionPublic] = Field(default_factory=list)
    productivity_hint: str | None = None


class FriendRequestCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)


class FriendIncomingPublic(BaseModel):
    id: int
    user_id: int
    username: str
    created_at: datetime


class FriendLeaderboardEntryPublic(BaseModel):
    rank: int
    user_id: int
    username: str
    current_streak_days: int
    sessions_in_period: int


class FriendLeaderboardPublic(BaseModel):
    period: str
    entries: list[FriendLeaderboardEntryPublic]


class FriendActivityPublic(BaseModel):
    session_id: int
    user_id: int
    username: str
    session_type: str
    completed_at: datetime
    duration_seconds: int


class FriendshipPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    friend_id: int
    status: FriendshipStatus
    created_at: datetime


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


# --- Extended stats & engagement ---


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
    intensity: int  # 0-4


class HeatmapPublic(BaseModel):
    days: list[HeatmapDayPublic]


class ProductivityInsightsPublic(BaseModel):
    best_hour_start: int | None = None
    best_weekday: str | None = None
    tips: list[str] = Field(default_factory=list)


class StatsInsightsPublic(BaseModel):
    productivity: ProductivityInsightsPublic
    weekly_goal_sessions: int | None = None
    weekly_goal_target: int | None = None
    weekly_goal_met: bool | None = None


class SessionTimelineSegmentPublic(BaseModel):
    kind: str  # "active" | "paused"
    seconds: int


class RelatedSessionPublic(BaseModel):
    id: int
    session_type: str
    duration_seconds: int | None
    started_at: datetime


class SessionDetailInsightsPublic(BaseModel):
    impact_lines: list[str]
    focus_score: int
    focus_label: str
    focus_percentile: int | None
    focus_user_average: int | None = None
    active_seconds: int
    paused_seconds: int
    effective_rate_percent: float
    timeline: list[SessionTimelineSegmentPublic]
    productivity_insights: list[str]
    related_sessions: list[RelatedSessionPublic]


class MotivationalMessagePublic(BaseModel):
    message: str
    variant: str = "default"


class PushTokenRegister(BaseModel):
    token: str = Field(min_length=8, max_length=512)
    platform: str = Field(default="unknown", max_length=32)
    channel: Literal["expo", "fcm"] = "expo"


class PushPingBody(BaseModel):
    """`template` selects canned copy; `test` uses optional title/body overrides."""

    template: Literal["test", "session_demo", "streak_demo"] = "test"
    title: str | None = Field(default=None, max_length=64)
    body: str | None = Field(default=None, max_length=200)
    streak_days: int | None = Field(default=None, ge=1, le=999)


class PushBulkResultPublic(BaseModel):
    attempted: int
    delivered_ok: int
    message: str | None = None


class GoalSetBody(BaseModel):
    goal_type: str = Field(default="weekly_sessions", max_length=64)
    target_value: int = Field(ge=1, le=50)


class GoalCurrentPublic(BaseModel):
    goal_type: str
    target_value: int
    week_start: str
    current_sessions: int
    progress_percent: float


class AchievementDefPublic(BaseModel):
    id: str
    title: str
    description: str
    emoji: str


class AchievementUnlockedPublic(BaseModel):
    id: str
    unlocked_at: datetime


class AchievementsListPublic(BaseModel):
    definitions: list[AchievementDefPublic]
    unlocked: list[AchievementUnlockedPublic]


class FriendStatusPublic(BaseModel):
    status: Literal["self", "none", "pending", "accepted"]


class UserPublicSessionItem(BaseModel):
    id: int
    session_type: str
    duration_seconds: int
    started_at: datetime
    mood_level: int | None = None


class UserFriendProfilePublic(BaseModel):
    id: int
    username: str
    total_sessions: int
    current_streak: int
    longest_streak: int
    friends_count: int
    created_at: datetime


class UserFriendStatsPublic(BaseModel):
    total_hours: float
    total_sessions: int
    current_streak: int
    longest_streak: int
    type_breakdown: dict[str, int]
    best_day: str | None
    heatmap_days: list[HeatmapDayPublic]
    achievements: list[AchievementUnlockedPublic]
