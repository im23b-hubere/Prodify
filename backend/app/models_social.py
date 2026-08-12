import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.model_support import utcnow


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
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
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
    note: Mapped[Optional[str]] = mapped_column(String(280), nullable=True)
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
    team_label: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SocialCommitment(Base):
    __tablename__ = "social_commitments"
    __table_args__ = (
        UniqueConstraint("user_id", "week_start", "commitment_key", name="uq_social_commitment_user_week_key"),
    )

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
