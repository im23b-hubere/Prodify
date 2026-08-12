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
from app.contracts.notifications import (
    NotificationInboxItemPublic,
    NotificationInboxReadBody,
    PushBulkResultPublic,
    PushPingBody,
    PushTokenRegister,
    SmartNudgeBody,
)
from app.contracts.outcomes import (
    GoalForecastPublic,
    KpiDashboardPublic,
    KpiSummaryPublic,
    KpiTrendPointPublic,
    OutputMetricsPublic,
    ProgressionLevelPublic,
    ProgressionPublic,
    SeedScreenshotAccountBody,
    WeeklyReviewPublic,
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
