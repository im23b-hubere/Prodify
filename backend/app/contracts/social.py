from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(value.strip().split())
    return cleaned or None


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
        return _clean_optional_text(value)


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
        cleaned = _clean_optional_text(value)
        if cleaned is None:
            raise ValueError("body must not be empty")
        return cleaned


class SocialReactionBody(BaseModel):
    emoji: str = Field(default="\U0001F44D", min_length=1, max_length=16)

    @field_validator("emoji")
    @classmethod
    def sanitize_emoji(cls, value: str) -> str:
        cleaned = value.strip()
        return cleaned or "\U0001F44D"


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


class SocialChallengeUpdateBody(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=120)
    target_sessions: int | None = Field(default=None, ge=1, le=50)
    duration_days: int | None = Field(default=None, ge=3, le=30)


class SocialChallengeMemberPublic(BaseModel):
    user_id: int
    username: str
    progress_sessions: int
    team_label: str | None = None


class SocialChallengePublic(BaseModel):
    id: int
    owner_id: int
    challenge_kind: str
    title: str
    week_start: str
    target_sessions: int
    duration_days: int = 7
    status: str
    days_remaining: int = 0
    leader_user_id: int | None = None
    winner_user_id: int | None = None
    is_tie: bool = False
    completion_reason: str | None = None
    your_rank: int | None = None
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
