import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    event,
    text,
)
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
    production = "production"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    # NULL for accounts created through Sign in with Apple / Google; password login is then refused.
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    profile_picture_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    # IANA identifier (e.g. "Europe/Berlin") reported by the device; NULL means "assume UTC".
    # Streak day boundaries are resolved in this zone, so travel and DST stay correct.
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_premium: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    premium_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    bonus_rescues: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bonus_challenge_slots: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Incremented on logout (and similar events) to invalidate outstanding access JWTs (`tv` claim).
    access_token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Set by a moderator; a suspended account cannot sign in until it is cleared again.
    suspended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
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


class PasswordResetCode(Base):
    """The one emailed code that may currently reset a user's password (keyed HMAC only)."""

    __tablename__ = "password_reset_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    failed_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SocialProvider(str, enum.Enum):
    apple = "apple"
    google = "google"


class UserIdentity(Base):
    """An external sign-in account (Apple / Google) linked to a Prodify user."""

    __tablename__ = "user_identities"
    __table_args__ = (UniqueConstraint("provider", "subject", name="uq_user_identity_provider_subject"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    # Stable provider account id (`sub` claim); emails can change or be hidden behind relays.
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    # Apple refresh token, kept only so account deletion can revoke the Apple authorization.
    provider_refresh_token: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship("User")


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
        Index("idx_sessions_user_stopped", "user_id", "stopped_at"),
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
    still_there_notified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    focus_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    track_outcome: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    track_title: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="sessions")
    skill_focuses: Mapped[list["SessionSkillFocus"]] = relationship(
        "SessionSkillFocus",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="SessionSkillFocus.id",
    )
    area_weights: Mapped[list["SessionAreaWeight"]] = relationship(
        "SessionAreaWeight",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="SessionAreaWeight.id",
    )

    @property
    def skill_focus_ids(self) -> list[str]:
        return [focus.skill_id for focus in self.skill_focuses]

    @property
    def weight_by_area(self) -> dict[str, int]:
        return {row.branch: row.weight for row in self.area_weights}

    @property
    def primary_skill_focus_id(self) -> Optional[str]:
        return next((focus.skill_id for focus in self.skill_focuses if focus.is_primary), None)

    @property
    def focus_times(self) -> list[dict[str, str | int]]:
        return [
            {"skill_id": focus.skill_id, "assigned_seconds": focus.assigned_seconds}
            for focus in self.skill_focuses
            if focus.assigned_seconds is not None
        ]


class SkillFocusSource(str, enum.Enum):
    planned = "planned"
    reflected = "reflected"


class SessionSkillFocus(Base):
    """A skill (see app/skill_catalog.py) the user practiced during a session."""

    __tablename__ = "session_skill_focuses"
    __table_args__ = (UniqueConstraint("session_id", "skill_id", name="uq_session_skill_focus"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # "planned" = chosen before/while producing; "reflected" = added after the session ended.
    source: Mapped[str] = mapped_column(String(16), nullable=False, default=SkillFocusSource.planned.value)
    # At most one focus per session is the main focus (unique max assigned time, or a stored star).
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    assigned_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SessionAreaWeight(Base):
    """How much of a production session went into one area (see app/skill_catalog.py)."""

    __tablename__ = "session_area_weights"
    __table_args__ = (UniqueConstraint("session_id", "branch", name="uq_session_area_weight"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    branch: Mapped[str] = mapped_column(String(32), nullable=False)
    weight: Mapped[int] = mapped_column(Integer, nullable=False)


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
    """One row per (user, local calendar day, reminder slot) to avoid duplicate server pushes."""

    __tablename__ = "streak_reminder_dispatch_log"
    __table_args__ = (
        UniqueConstraint("user_id", "utc_day_key", "slot_kind", name="uq_streak_reminder_dispatch_slot"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # The column predates per-user timezones; it now holds the user's local day key.
    day_key: Mapped[str] = mapped_column("utc_day_key", String(10), nullable=False)
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
    __table_args__ = (
        UniqueConstraint("user_id", "friend_id", name="uq_friendship_pair"),
        CheckConstraint("user_id <> friend_id", name="ck_friendship_no_self"),
        Index("idx_friendships_status_user", "status", "user_id"),
        Index("idx_friendships_status_friend", "status", "friend_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    friend_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[FriendshipStatus] = mapped_column(
        SAEnum(FriendshipStatus, native_enum=False, length=20),
        default=FriendshipStatus.pending,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


@event.listens_for(Friendship.__table__, "after_create")
def _create_friendship_canonical_pair_index(target, connection, **_kwargs) -> None:
    """Block A→B and B→A as two rows (SQLite min/max, PostgreSQL LEAST/GREATEST)."""
    pair_expr = (
        "LEAST(user_id, friend_id), GREATEST(user_id, friend_id)"
        if connection.dialect.name == "postgresql"
        else "min(user_id, friend_id), max(user_id, friend_id)"
    )
    connection.execute(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_friendship_canonical_pair "
            f"ON friendships ({pair_expr})"
        )
    )


class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="revenuecat")
    entitlement: Mapped[str] = mapped_column(String(32), nullable=False, default="inactive")
    trial_active: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rc_app_user_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


from app.models_engagement import (
    DeliveryOutcome,
    LeaderboardSnapshot,
    NotificationDelivery,
    UserEngagementProfile,
    UserNotificationPreferences,
)
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
    FriendNudge,
    SocialChallenge,
    SocialChallengeMember,
    SocialComment,
    SocialCommitment,
    SocialReaction,
    StreakRescue,
    UserBlock,
    ContentReport,
)
