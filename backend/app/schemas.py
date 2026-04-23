import json
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import FriendshipStatus, SessionType


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        # Treat email identity as case-insensitive and ignore accidental whitespace.
        return str(value).strip().lower()

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        normalized = value.strip().lower()
        if len(normalized) < 2:
            raise ValueError("username must contain at least 2 characters")
        return normalized


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class UserPublic(BaseModel):
    """Friend-visible / non-account fields (no email)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    profile_picture_url: str | None = None
    is_premium: bool = False
    created_at: datetime


class UserAccountPublic(BaseModel):
    """Authenticated account view — includes email for the signed-in user only."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    username: str
    profile_picture_url: str | None = None
    is_premium: bool = False
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=8, max_length=4096)


class SessionQuickStart(BaseModel):
    session_type: SessionType = SessionType.beat_making


class SessionStart(BaseModel):
    session_type: SessionType
    notes: str | None = Field(default=None, max_length=200)
    mood_level: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] | None = None

    @field_validator("notes")
    @classmethod
    def sanitize_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.strip().split())
        return cleaned or None

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
    session_id: int = Field(gt=0)


class SessionUpdate(BaseModel):
    session_type: SessionType | None = None
    notes: str | None = Field(default=None, max_length=2000)
    mood_level: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] | None = None
    track_outcome: Literal["none", "wip", "finished"] | None = None
    track_title: str | None = Field(default=None, max_length=160)

    @field_validator("notes")
    @classmethod
    def sanitize_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.strip().split())
        return cleaned or None

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

    @field_validator("track_title")
    @classmethod
    def sanitize_track_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.strip().split())
        return cleaned or None


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
    track_outcome: Literal["none", "wip", "finished"] | None = None
    track_title: str | None = None

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


class InsightItemPublic(BaseModel):
    """Stable keys + params for client-side i18n (see mobile `sessionInsights.api.*`)."""

    key: str
    params: dict[str, int | float | str] = Field(default_factory=dict)


class SessionStatsPublic(BaseModel):
    period: str
    summary: SessionStatsSummary
    trend: list[SessionStatsTrendPoint]
    breakdown: list[SessionStatsTypeBreakdownItem]
    recent_sessions: list[SessionPublic] = Field(default_factory=list)
    productivity_hint: str | None = None
    productivity_hint_item: InsightItemPublic | None = None


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
    best_weekday_index: int | None = None
    tips: list[str] = Field(default_factory=list)
    tip_items: list[InsightItemPublic] = Field(default_factory=list)


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


class EntitlementPublic(BaseModel):
    provider: str = "revenuecat"
    entitlement: Literal["free", "premium"] = "free"
    trial_active: bool = False
    expires_at: datetime | None = None


class BillingSyncBody(BaseModel):
    app_user_id: str = Field(min_length=1, max_length=255)
    entitlement: Literal["free", "premium"] = "free"
    trial_active: bool = False
    expires_at: datetime | None = None

    @field_validator("app_user_id")
    @classmethod
    def sanitize_app_user_id(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("app_user_id must not be empty")
        return cleaned


class ProgressionPublic(BaseModel):
    xp_total: int
    current_level: int
    xp_to_next_level: int
    progress_percent: float


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


class CoachDebriefPublic(BaseModel):
    session_id: int
    went_well: list[str] = Field(default_factory=list)
    didnt_go_well: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    tone: str = "motivating_realistic"


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


class PublicGoalBody(BaseModel):
    target_sessions: int = Field(ge=1, le=50, default=4)
    is_public: bool = False


class PublicGoalPublic(BaseModel):
    week_start: str
    target_sessions: int
    is_public: bool


class WeeklyCheckinBody(BaseModel):
    did_ship: bool
    shipped_note: str | None = Field(default=None, max_length=280)


class WeeklyCheckinPublic(BaseModel):
    week_start: str
    did_ship: bool
    shipped_note: str | None = None


class ChallengeJoinBody(BaseModel):
    challenge_id: int = Field(gt=0)


class ChallengeEntryPublic(BaseModel):
    user_id: int
    score: int


class ChallengeLeaderboardPublic(BaseModel):
    challenge_id: int
    week_start: str
    entries: list[ChallengeEntryPublic] = Field(default_factory=list)


class BuddyInviteBody(BaseModel):
    friend_user_id: int = Field(gt=0)


class BuddyInviteAcceptBody(BaseModel):
    invite_id: int = Field(gt=0)


class BuddyStatusPublic(BaseModel):
    invite_id: int | None = None
    status: Literal["none", "pending_outgoing", "pending_incoming", "active"]
    buddy_user_id: int | None = None
    buddy_username: str | None = None
    this_week_sessions: int = 0
    buddy_week_sessions: int = 0


class CheckinPlanBody(BaseModel):
    target_checkins: int = Field(default=3, ge=1, le=7)


class CheckinLogBody(BaseModel):
    note: str | None = Field(default=None, max_length=280)

    @field_validator("note")
    @classmethod
    def sanitize_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.strip().split())
        return cleaned or None


class CheckinDayStatePublic(BaseModel):
    day_key: str
    state: Literal["done", "open", "missed"]


class CheckinStatusPublic(BaseModel):
    week_start: str
    target_checkins: int
    done_count: int
    on_track: bool
    day_states: list[CheckinDayStatePublic] = Field(default_factory=list)


class SocialCommentBody(BaseModel):
    body: str = Field(min_length=1, max_length=400)

    @field_validator("body")
    @classmethod
    def sanitize_body(cls, value: str) -> str:
        cleaned = " ".join(value.strip().split())
        if not cleaned:
            raise ValueError("body must not be empty")
        return cleaned


class SocialReactionBody(BaseModel):
    emoji: str = Field(default="👍", min_length=1, max_length=16)

    @field_validator("emoji")
    @classmethod
    def sanitize_emoji(cls, value: str) -> str:
        cleaned = value.strip()
        return cleaned or "👍"


class SocialCommentPublic(BaseModel):
    id: int
    target_type: str
    target_id: int
    author_id: int
    author_username: str
    author_profile_picture_url: str | None = None
    body: str
    created_at: datetime


class SocialReactionPublic(BaseModel):
    target_type: str
    target_id: int
    emoji: str
    count: int
    reacted_by_me: bool = False


class SocialReactionUserPublic(BaseModel):
    user_id: int
    username: str
    emoji: str
    created_at: datetime


class SocialChallengeCreateBody(BaseModel):
    challenge_kind: Literal["duel", "team", "group"] = "duel"
    title: str = Field(min_length=3, max_length=120)
    target_sessions: int = Field(default=5, ge=1, le=50)
    duration_days: int = Field(default=7, ge=3, le=30)
    member_user_ids: list[int] = Field(default_factory=list)


class SocialChallengeJoinBody(BaseModel):
    challenge_id: int = Field(gt=0)


class SocialChallengeMemberPublic(BaseModel):
    user_id: int
    username: str
    progress_sessions: int
    team_label: str | None = None


class SocialChallengePublic(BaseModel):
    id: int
    challenge_kind: str
    title: str
    week_start: str
    target_sessions: int
    duration_days: int = 7
    status: str
    premium_detail_locked: bool = False
    upsell_hint: str | None = None
    members: list[SocialChallengeMemberPublic] = Field(default_factory=list)


class CommitmentBody(BaseModel):
    target_sessions: int = Field(ge=1, le=50)
    visibility: Literal["friends", "buddy"] = "friends"
    commitment_key: Literal["sessions", "checkins", "focus_hours"] = "sessions"
    period_days: int = Field(default=7, ge=7, le=30)
    witness_user_ids: list[int] = Field(default_factory=list)


class CommitmentPublic(BaseModel):
    week_start: str
    commitment_key: str = "sessions"
    period_days: int = 7
    target_sessions: int
    current_sessions: int
    status: Literal["on_track", "behind", "completed"]
    visibility: str
    upsell_hint: str | None = None
    witness_user_ids: list[int] = Field(default_factory=list)
    witness_usernames: list[str] = Field(default_factory=list)


class StreakRescueBody(BaseModel):
    rescued_user_id: int = Field(gt=0)


class SocialLeaderboardContextEntry(BaseModel):
    user_id: int
    username: str
    rank: int
    sessions: int
    movement: int
    trend: Literal["up", "down", "flat"]


class SocialLeaderboardContextPublic(BaseModel):
    entries: list[SocialLeaderboardContextEntry] = Field(default_factory=list)
    chasing_user_id: int | None = None
    threatening_user_id: int | None = None


class SocialWeeklyRecapPublic(BaseModel):
    week_start: str
    your_sessions: int
    buddy_sessions: int
    team_sessions: int
    wow_delta_sessions: int
    has_active_buddy: bool = False
    identity_tag: str | None = None
    trend_vs_last_week_percent: float | None = None
    premium_detail_locked: bool = False
    upsell_hint: str | None = None


class BuddyRiskPublic(BaseModel):
    buddy_user_id: int | None = None
    buddy_username: str | None = None
    buddy_streak_at_risk: bool = False
    rescue_available: bool = False
    rescued_today: bool = False


class IdentityStatePublic(BaseModel):
    primary_tag: str
    secondary_tag: str | None = None
    tags: list[str] = Field(default_factory=list)
    line: str
