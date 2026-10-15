"""Tables behind the adaptive engagement engine: what was sent and what the producer did next."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
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
        ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True
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
