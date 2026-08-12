from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.contracts.auth import (
    RefreshRequest,
    Token,
    TokenPair,
    UserAccountPublic,
    UserCreate,
    UserLogin,
    UserPublic,
)
from app.contracts.billing import BillingSyncBody, EntitlementPublic
from app.contracts.insights import (
    HeatmapDayPublic,
    HeatmapPublic,
    PersonalRecordItem,
    PersonalRecordsPublic,
    ProductivityInsightsPublic,
    RelatedSessionPublic,
    SessionDetailInsightsPublic,
    SessionTimelineSegmentPublic,
    StatsInsightsPublic,
    StreakFreezeResult,
    StreakMilestoneItem,
    StreakMilestonesPublic,
    StreakOverviewPublic,
    StreakPublic,
    StreakRunPublic,
)
from app.contracts.sessions import (
    InsightItemPublic,
    SessionPublic,
    SessionQuickStart,
    SessionStart,
    SessionStatsPublic,
    SessionStatsSummary,
    SessionStatsTrendPoint,
    SessionStatsTypeBreakdownItem,
    SessionStop,
    SessionUpdate,
)
from app.contracts.social import (
    BuddyInviteAcceptBody,
    BuddyInviteBody,
    BuddyRiskPublic,
    BuddyStatusPublic,
    ChallengeEntryPublic,
    ChallengeJoinBody,
    ChallengeLeaderboardPublic,
    CheckinDayStatePublic,
    CheckinLogBody,
    CheckinPlanBody,
    CheckinStatusPublic,
    CommitmentBody,
    CommitmentPublic,
    IdentityStatePublic,
    PublicGoalBody,
    PublicGoalPublic,
    SocialChallengeCreateBody,
    SocialChallengeJoinBody,
    SocialChallengeMemberPublic,
    SocialChallengePublic,
    SocialChallengeUpdateBody,
    SocialCommentBody,
    SocialCommentPublic,
    SocialLeaderboardContextEntry,
    SocialLeaderboardContextPublic,
    SocialReactionBody,
    SocialReactionPublic,
    SocialReactionUserPublic,
    SocialWeeklyRecapPublic,
    StreakRescueBody,
    WeeklyCheckinBody,
    WeeklyCheckinPublic,
)
from app.models import FriendshipStatus, SessionType


class FriendRequestCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        normalized = value.strip().lower()
        if len(normalized) < 2:
            raise ValueError("username must contain at least 2 characters")
        return normalized


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
    sessions_delta_vs_prior: int = 0
    trend: Literal["up", "down", "flat"] = "flat"
    is_chasing_you: bool = False
    is_threatening_you: bool = False
    is_premium: bool = False
    profile_picture_url: str | None = None
    streak_status_key: str = "starting"
    streak_status_label: str = "STARTING"
    streak_status_emoji: str = "🌱"


class FriendLeaderboardPublic(BaseModel):
    period: str
    entries: list[FriendLeaderboardEntryPublic]


class FriendActivityPublic(BaseModel):
    session_id: int
    user_id: int
    username: str
    profile_picture_url: str | None = None
    session_type: str
    activity_at: datetime
    status: str = "completed"
    completed_at: datetime | None = None
    duration_seconds: int | None = None
    reactions_count: int = 0
    comments_count: int = 0
    viewer_reaction: str | None = None
    streak_status_key: str = "starting"
    streak_status_label: str = "STARTING"
    streak_status_emoji: str = "🌱"
    event_message: str | None = None
    streak_break_days: int | None = None


class FriendshipPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    friend_id: int
    status: FriendshipStatus
    created_at: datetime


class MotivationalMessagePublic(BaseModel):
    """`message_key` selects mobile i18n (`motivationApi.<key>`); `message` is legacy fallback."""

    message: str = ""
    message_key: str
    variant: str = "default"


class PushTokenRegister(BaseModel):
    token: str = Field(min_length=8, max_length=512)
    platform: str = Field(default="unknown", max_length=32)
    channel: Literal["expo", "fcm"] = "expo"

    @field_validator("token")
    @classmethod
    def sanitize_token(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 8:
            raise ValueError("token must contain at least 8 characters")
        return cleaned

    @field_validator("platform")
    @classmethod
    def normalize_platform(cls, value: str) -> str:
        normalized = value.strip().lower()
        allowed = {"ios", "android", "web", "unknown"}
        if normalized not in allowed:
            return "unknown"
        return normalized


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


class NotificationInboxItemPublic(BaseModel):
    id: str
    category: Literal["streak", "achievement", "social", "tips"]
    priority: Literal["low", "normal", "high", "critical"] = "normal"
    title: str
    body: str
    title_key: str | None = None
    title_params: dict[str, int | float | str] = Field(default_factory=dict)
    body_key: str | None = None
    body_params: dict[str, int | float | str] = Field(default_factory=dict)
    created_at: datetime
    expires_at: datetime | None = None
    read: bool = False
    action_label: str | None = None
    action_route: str | None = None


class NotificationInboxReadBody(BaseModel):
    up_to_ms: int | None = Field(default=None, ge=0)


class SmartNudgeBody(BaseModel):
    kind: Literal["inactivity", "best_time", "forecast_risk"] = "inactivity"
    hour: int | None = Field(default=None, ge=0, le=23)
    remaining_sessions: int | None = Field(default=None, ge=0, le=100)
    days_left: int | None = Field(default=None, ge=0, le=30)
    days_inactive: int | None = Field(default=None, ge=1, le=60)


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
    username: str | None = None
    pending_direction: Literal["outgoing", "incoming"] | None = None


class FriendPostAcceptActionPublic(BaseModel):
    key: str
    title: str
    cta_label: str
    route_hint: str


class UserPublicSessionItem(BaseModel):
    id: int
    session_type: str
    duration_seconds: int
    started_at: datetime
    mood_level: int | None = None


class UserFriendProfilePublic(BaseModel):
    id: int
    username: str
    profile_picture_url: str | None = None
    total_sessions: int
    current_streak: int
    longest_streak: int
    friends_count: int
    is_premium: bool = False
    identity_tags: list[str] = Field(default_factory=list)
    created_at: datetime
    reliability_score: float = 0.0
    reliability_trend: Literal["up", "down", "stable"] = "stable"
    reliability_rank_percent: int | None = None
    streak_status_key: str = "starting"
    streak_status_label: str = "STARTING"
    streak_status_emoji: str = "🌱"


class ReliabilityScorePublic(BaseModel):
    score: float
    trend: Literal["up", "down", "stable"]
    rank_percent: int | None = None
    consistency_90d: float
    completion_rate_90d: float


class UserFriendStatsPublic(BaseModel):
    total_hours: float
    total_sessions: int
    current_streak: int
    longest_streak: int
    type_breakdown: dict[str, int]
    best_day: str | None
    heatmap_days: list[HeatmapDayPublic]
    achievements: list[AchievementUnlockedPublic]


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


class LegalDocumentMetaPublic(BaseModel):
    title: str
    version: str
    effective_date: str
    url: str
    in_app_path: str


class LegalDocumentsPublic(BaseModel):
    privacy: LegalDocumentMetaPublic
    terms: LegalDocumentMetaPublic
    support_email: str


class FeatureFlagsPublic(BaseModel):
    billing_sync_enabled: bool
    push_notifications_enabled: bool
    smart_nudges_enabled: bool
