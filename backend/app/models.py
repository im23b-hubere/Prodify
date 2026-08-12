import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.model_support import utcnow


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
    profile_picture_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    is_premium: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    premium_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    bonus_rescues: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bonus_challenge_slots: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Incremented on logout (and similar events) to invalidate outstanding access JWTs (`tv` claim).
    access_token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    sessions: Mapped[list["ProductionSession"]] = relationship(
        "ProductionSession", back_populates="user", cascade="all, delete-orphan"
    )
    streak: Mapped["Streak"] = relationship(
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
    stopped_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    session_type: Mapped[str] = mapped_column(String(64), nullable=False, default=SessionType.beat_making.value)
    notes: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    mood_level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    paused_duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pause_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    focus_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    track_outcome: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    track_title: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="sessions")


class Streak(Base):
    __tablename__ = "streaks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_session_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
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
    last_read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
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
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rc_app_user_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


from app.models_growth import (
    AnalyticsEventDedupe,
    ChallengeParticipant,
    GrowthEvent,
    PublicGoal,
    StreakBreakNotifyDedupe,
    UserProgression,
    WeeklyChallenge,
    WeeklyCheckin,
    WeeklyReviewSnapshot,
    XpLedger,
)
from app.models_social import (
    BuddyRelationship,
    BuddyStatus,
    CheckinLog,
    CheckinPlan,
    SocialChallenge,
    SocialChallengeMember,
    SocialComment,
    SocialCommitment,
    SocialReaction,
    StreakRescue,
)
