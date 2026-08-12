from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.model_support import utcnow


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
    __table_args__ = (
        Index("idx_xp_ledger_user_created", "user_id", "created_at"),
        Index(
            "uq_xp_ledger_idempotent_source",
            "user_id",
            "source_type",
            "source_id",
            unique=True,
            sqlite_where=text("source_id IS NOT NULL AND source_type != 'inactivity_decay'"),
            postgresql_where=text("source_id IS NOT NULL AND source_type != 'inactivity_decay'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
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
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
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
    """Deduplicate high-frequency analytics writes per user and logical bucket."""

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
    share_image_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
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
    shipped_note: Mapped[Optional[str]] = mapped_column(String(280), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
