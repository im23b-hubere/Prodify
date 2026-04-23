import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class FriendshipStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"


class SessionType(str, enum.Enum):
    beat_making = "beat_making"
    mixing = "mixing"
    mastering = "mastering"
    mix_and_master = "mix_and_master"
    sound_design = "sound_design"
    recording = "recording"
    songwriting = "songwriting"
    arrangement = "arrangement"
    vocal_production = "vocal_production"
    learning = "learning"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    profile_picture_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_premium: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    premium_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bonus_rescues: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bonus_challenge_slots: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Incremented on logout (and similar events) to invalidate outstanding access JWTs (`tv` claim).
    access_token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    sessions: Mapped[list["ProductionSession"]] = relationship(
        "ProductionSession", back_populates="user", cascade="all, delete-orphan"
    )
    streak: Mapped["Streak | None"] = relationship(
        "Streak", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )


class RefreshToken(Base):
    """Opaque refresh tokens (store SHA-256 hash only)."""

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")


class ProductionSession(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        Index(
            "idx_one_active_session_per_user",
            "user_id",
            unique=True,
            sqlite_where=text("stopped_at IS NULL AND deleted_at IS NULL"),
            postgresql_where=text("stopped_at IS NULL AND deleted_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    stopped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    session_type: Mapped[str] = mapped_column(String(64), nullable=False, default=SessionType.beat_making.value)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    mood_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tags: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    paused_duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pause_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    focus_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    track_outcome: Mapped[str | None] = mapped_column(String(20), nullable=True)
    track_title: Mapped[str | None] = mapped_column(String(160), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="sessions")


class Streak(Base):
    __tablename__ = "streaks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_session_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # JSON array of UTC date keys (YYYY-MM-DD) counting as "activity" for streak via freeze
    frozen_day_keys: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    freezes_remaining: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    # YYYY-MM for monthly freeze allowance reset
    billing_month: Mapped[str] = mapped_column(String(7), default="", nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="streak")


class PushToken(Base):
    __tablename__ = "push_tokens"
    __table_args__ = (UniqueConstraint("user_id", "token", "channel", name="uq_push_tokens_user_token_channel"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token: Mapped[str] = mapped_column(String(512), nullable=False)
    platform: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    channel: Mapped[str] = mapped_column(String(16), nullable=False, default="expo")
    is_active: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class NotificationReadState(Base):
    __tablename__ = "notification_read_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StreakReminderDispatchLog(Base):
    """One row per (user, UTC calendar day, reminder slot) to avoid duplicate server pushes."""

    __tablename__ = "streak_reminder_dispatch_log"
    __table_args__ = (
        UniqueConstraint("user_id", "utc_day_key", "slot_kind", name="uq_streak_reminder_dispatch_slot"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    utc_day_key: Mapped[str] = mapped_column(String(10), nullable=False)
    slot_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class UserGoal(Base):
    __tablename__ = "user_goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    goal_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_value: Mapped[int] = mapped_column(Integer, nullable=False)
    week_start: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    achievement_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (UniqueConstraint("user_id", "friend_id", name="uq_friendship_pair"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    friend_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[FriendshipStatus] = mapped_column(
        SAEnum(FriendshipStatus, native_enum=False, length=20),
        default=FriendshipStatus.pending,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="revenuecat")
    entitlement: Mapped[str] = mapped_column(String(32), nullable=False, default="free")
    trial_active: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rc_app_user_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class UserProgression(Base):
    __tablename__ = "user_progression"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    xp_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    xp_to_next_level: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class XpLedger(Base):
    __tablename__ = "xp_ledger"
    __table_args__ = (Index("idx_xp_ledger_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    xp_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    meta_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class GrowthEvent(Base):
    __tablename__ = "growth_events"
    __table_args__ = (
        Index("idx_growth_event_name_created", "event_name", "created_at"),
        Index("idx_growth_event_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    event_name: Mapped[str] = mapped_column(String(96), nullable=False)
    event_props_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StreakBreakNotifyDedupe(Base):
    """At most one streak-break friend notification per user per UTC calendar day."""

    __tablename__ = "streak_break_notify_dedupe"
    __table_args__ = (UniqueConstraint("user_id", "utc_day_key", name="uq_streak_break_notify_user_day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    utc_day_key: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AnalyticsEventDedupe(Base):
    """Deduplicate high-frequency analytics writes (e.g. repeated GETs) per user + logical bucket."""

    __tablename__ = "analytics_event_dedupe"
    __table_args__ = (UniqueConstraint("user_id", "bucket_key", name="uq_analytics_event_dedupe_user_bucket"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    bucket_key: Mapped[str] = mapped_column(String(192), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WeeklyReviewSnapshot(Base):
    __tablename__ = "weekly_review_snapshots"
    __table_args__ = (UniqueConstraint("user_id", "week_start", name="uq_weekly_review_user_week"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    week_start: Mapped[str] = mapped_column(String(10), nullable=False)
    week_end: Mapped[str] = mapped_column(String(10), nullable=False)
    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    insights_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    blockers_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    suggestions_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    ai_feedback: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    share_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PublicGoal(Base):
    __tablename__ = "public_goals"
    __table_args__ = (UniqueConstraint("user_id", "week_start", name="uq_public_goals_user_week"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    week_start: Mapped[str] = mapped_column(String(10), nullable=False)
    target_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    is_public: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WeeklyChallenge(Base):
    __tablename__ = "weekly_challenges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    week_start: Mapped[str] = mapped_column(String(10), index=True, nullable=False)
    challenge_type: Mapped[str] = mapped_column(String(64), nullable=False, default="session_count")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    config_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ChallengeParticipant(Base):
    __tablename__ = "challenge_participants"
    __table_args__ = (
        UniqueConstraint("challenge_id", "user_id", name="uq_challenge_participants"),
        Index("idx_challenge_participants_challenge_score", "challenge_id", "score"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    challenge_id: Mapped[int] = mapped_column(
        ForeignKey("weekly_challenges.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WeeklyCheckin(Base):
    __tablename__ = "weekly_checkins"
    __table_args__ = (UniqueConstraint("user_id", "week_start", name="uq_weekly_checkins_user_week"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    week_start: Mapped[str] = mapped_column(String(10), nullable=False)
    did_ship: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    shipped_note: Mapped[str | None] = mapped_column(String(280), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BuddyStatus(str, enum.Enum):
    pending = "pending"
    active = "active"


class BuddyRelationship(Base):
    __tablename__ = "buddy_relationships"
    __table_args__ = (
        UniqueConstraint("requester_id", "addressee_id", name="uq_buddy_pair"),
        UniqueConstraint("requester_id", name="uq_buddy_requester_single"),
        UniqueConstraint("addressee_id", name="uq_buddy_addressee_single"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    addressee_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    status: Mapped[BuddyStatus] = mapped_column(
        SAEnum(BuddyStatus, native_enum=False, length=20),
        nullable=False,
        default=BuddyStatus.pending,
    )
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CheckinPlan(Base):
    __tablename__ = "checkin_plans"
    __table_args__ = (UniqueConstraint("user_id", "week_start", name="uq_checkin_plan_user_week"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    week_start: Mapped[str] = mapped_column(String(10), nullable=False)
    target_checkins: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CheckinLog(Base):
    __tablename__ = "checkin_logs"
    __table_args__ = (UniqueConstraint("user_id", "day_key", name="uq_checkin_log_user_day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    day_key: Mapped[str] = mapped_column(String(10), nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="done")
    note: Mapped[str | None] = mapped_column(String(280), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SocialComment(Base):
    __tablename__ = "social_comments"
    __table_args__ = (Index("idx_social_comments_target_created", "target_type", "target_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    target_type: Mapped[str] = mapped_column(String(32), nullable=False, default="session")
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    body: Mapped[str] = mapped_column(String(400), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SocialReaction(Base):
    __tablename__ = "social_reactions"
    __table_args__ = (
        UniqueConstraint("target_type", "target_id", "user_id", "emoji", name="uq_social_reaction_unique"),
        Index("idx_social_reactions_target", "target_type", "target_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    target_type: Mapped[str] = mapped_column(String(32), nullable=False, default="session")
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    emoji: Mapped[str] = mapped_column(String(16), nullable=False, default="👍")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SocialChallenge(Base):
    __tablename__ = "social_challenges"
    __table_args__ = (Index("idx_social_challenges_status_week", "status", "week_start"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    challenge_kind: Mapped[str] = mapped_column(String(20), nullable=False, default="duel")
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    week_start: Mapped[str] = mapped_column(String(10), nullable=False)
    target_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    meta_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SocialChallengeMember(Base):
    __tablename__ = "social_challenge_members"
    __table_args__ = (
        UniqueConstraint("challenge_id", "user_id", name="uq_social_challenge_member"),
        Index("idx_social_challenge_member_score", "challenge_id", "progress_sessions"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    challenge_id: Mapped[int] = mapped_column(
        ForeignKey("social_challenges.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    progress_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    team_label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SocialCommitment(Base):
    __tablename__ = "social_commitments"
    __table_args__ = (UniqueConstraint("user_id", "week_start", "commitment_key", name="uq_social_commitment_user_week_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    week_start: Mapped[str] = mapped_column(String(10), nullable=False)
    commitment_key: Mapped[str] = mapped_column(String(32), nullable=False, default="sessions")
    period_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    target_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default="friends")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StreakRescue(Base):
    __tablename__ = "streak_rescues"
    __table_args__ = (
        UniqueConstraint("rescued_user_id", "day_key", name="uq_streak_rescue_day"),
        Index("idx_streak_rescue_rescuer_created", "rescuer_user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rescued_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    rescuer_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    day_key: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
