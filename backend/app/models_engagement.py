"""Tables behind the adaptive engagement engine: what was sent and what the producer did next."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.model_support import utcnow
from app.timeutil import as_utc_aware


class DeliveryOutcome:
    PENDING = "pending"
    CONVERTED = "converted"
    OPENED_ONLY = "opened_only"
    IGNORED = "ignored"


class NotificationDelivery(Base):
    """
    One push sent to one producer. Its id travels in the push payload (`nid`) so opens and
    the session that followed can be attributed back to it.
    """

    __tablename__ = "notification_deliveries"
    __table_args__ = (Index("idx_notification_delivery_user_sent", "user_id", "sent_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    notification_type: Mapped[str] = mapped_column(String(48), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    delivered_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    app_opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    session_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("sessions.id", ondelete="SET NULL"), index=True, nullable=True
    )
    session_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    outcome: Mapped[str] = mapped_column(String(16), nullable=False, default=DeliveryOutcome.PENDING)
    # Why the engine chose this push; empty for pushes that are not engine decisions.
    candidate_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    variables_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")

    @property
    def minutes_until_session(self) -> int | None:
        if self.session_started_at is None:
            return None
        elapsed = as_utc_aware(self.session_started_at) - as_utc_aware(self.sent_at)
        return int(elapsed.total_seconds() // 60)


DEFAULT_QUIET_START_MINUTE = 22 * 60 + 30
DEFAULT_QUIET_END_MINUTE = 8 * 60


class UserNotificationPreferences(Base):
    """
    Which pushes a producer wants. Quiet minutes are local minutes since midnight; equal start
    and end mean no quiet window. Producers without a row get the defaults.
    """

    __tablename__ = "user_notification_preferences"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    smart_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    streak_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    social_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    challenge_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    rank_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    reengagement_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    quiet_start_minute: Mapped[int] = mapped_column(Integer, nullable=False, default=DEFAULT_QUIET_START_MINUTE)
    quiet_end_minute: Mapped[int] = mapped_column(Integer, nullable=False, default=DEFAULT_QUIET_END_MINUTE)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class UserEngagementProfile(Base):
    """
    The stored `BehaviorProfile` of one producer, recomputed after each completed session and
    whenever the engine finds it stale. Histograms are in the producer's local time.
    """

    __tablename__ = "user_engagement_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stage: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    session_hour_histogram_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    weekday_histogram_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    avg_sessions_per_week: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    avg_session_duration_minutes: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    last_session_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sessions_last_7_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sessions_previous_7_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_session_duration_minutes: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    # Learned from settled deliveries; recomputed whenever a push converts or is ignored.
    motivation_scores_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    fatigue_score: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    ignored_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    preferred_notification_hour: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    preferred_notification_slots_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    # Stored by each engine run; the previous local day's value lets the engine spot a sharp drop.
    segment: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    return_probability_24h: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    return_probability_day: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    previous_return_probability: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class LeaderboardSnapshot(Base):
    """
    The producer's last seen place on their friend leaderboard for one local week, so the next
    engine run can tell that a friend has moved ahead of them.
    """

    __tablename__ = "leaderboard_snapshots"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    week_start: Mapped[str] = mapped_column(String(10), primary_key=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    session_count: Mapped[int] = mapped_column(Integer, nullable=False)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
