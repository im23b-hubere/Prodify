"""
Notification delivery tracking and attribution.

A push "converts" when the producer starts a session within the attribution window after
it was sent. Only the most recent eligible push gets the credit, and pushes that merely
report something the producer just did (session saved, still there?) never do.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DeliveryOutcome, NotificationDelivery
from app.services.engagement.events import EngagementEvent
from app.services.kpi_tracker import track_event, track_event_deduped

ATTRIBUTION_WINDOW = timedelta(hours=2)
APP_OPEN_BUCKET_MINUTES = 30

# Pushes that confirm or report on the producer's own action, plus internal/QA pings.
TRANSACTIONAL_TYPES = frozenset(
    {
        "session_complete",
        "session_still_there",
        "session_auto_stopped",
        "content_report",
        "test_ping",
        "session_demo",
        "streak_demo",
    }
)
GENERIC_TYPE = "generic"


class DeliveryNotFoundError(Exception):
    pass


def notification_type_of(data: dict[str, str] | None) -> str:
    if not data:
        return GENERIC_TYPE
    return data.get("kind") or data.get("type") or GENERIC_TYPE


@dataclass(frozen=True)
class EngineChoice:
    """Why the engagement engine sent a push; stored on its delivery."""

    score: int
    reason: str
    variables: dict[str, str]


def create_delivery(
    db: Session,
    user_id: int,
    notification_type: str,
    sent_at: datetime,
    *,
    choice: EngineChoice | None = None,
) -> NotificationDelivery:
    delivery = NotificationDelivery(
        user_id=user_id,
        notification_type=notification_type[:48],
        sent_at=sent_at,
        candidate_score=choice.score if choice else None,
        reason=choice.reason[:255] if choice else None,
        variables_json=json.dumps(choice.variables if choice else {}),
    )
    db.add(delivery)
    db.flush()
    return delivery


def record_dispatch_result(db: Session, delivery: NotificationDelivery, delivered: int) -> None:
    delivery.delivered_count = delivered
    track_event(
        db,
        EngagementEvent.NOTIFICATION_SENT,
        delivery.user_id,
        {"notification_id": delivery.id, "type": delivery.notification_type, "delivered": delivered},
    )


def mark_opened(db: Session, user_id: int, delivery_id: str, now: datetime) -> None:
    delivery = db.get(NotificationDelivery, delivery_id)
    if delivery is None or delivery.user_id != user_id:
        raise DeliveryNotFoundError
    if delivery.opened_at is not None:
        return
    delivery.opened_at = now
    track_event(
        db,
        EngagementEvent.NOTIFICATION_OPENED,
        user_id,
        {"notification_id": delivery.id, "type": delivery.notification_type},
    )


def record_app_open(db: Session, user_id: int, now: datetime) -> None:
    bucket = now.replace(minute=now.minute - now.minute % APP_OPEN_BUCKET_MINUTES, second=0, microsecond=0)
    track_event_deduped(
        db,
        user_id=user_id,
        bucket_key=f"app_open:{bucket.isoformat()}",
        event_name=EngagementEvent.APP_OPENED,
    )
    delivery = _latest_attributable_delivery(db, user_id, now)
    if delivery is not None and delivery.app_opened_at is None:
        delivery.app_opened_at = now


def attribute_session_start(
    db: Session,
    user_id: int,
    *,
    session_id: int,
    started_at: datetime,
) -> NotificationDelivery | None:
    delivery = _latest_attributable_delivery(db, user_id, started_at)
    if delivery is None:
        return None
    delivery.session_id = session_id
    delivery.session_started_at = started_at
    delivery.outcome = DeliveryOutcome.CONVERTED
    track_event(
        db,
        EngagementEvent.SESSION_STARTED_AFTER_NOTIFICATION,
        user_id,
        {
            "notification_id": delivery.id,
            "type": delivery.notification_type,
            "session_id": session_id,
            "minutes_until_session": delivery.minutes_until_session,
        },
    )
    return delivery


def settle_expired_deliveries(db: Session, now: datetime) -> int:
    """Close pending deliveries whose attribution window has passed without a session."""
    expired = db.scalars(
        select(NotificationDelivery).where(
            NotificationDelivery.outcome == DeliveryOutcome.PENDING,
            NotificationDelivery.sent_at < now - ATTRIBUTION_WINDOW,
        )
    ).all()
    for delivery in expired:
        delivery.outcome = DeliveryOutcome.OPENED_ONLY if delivery.opened_at else DeliveryOutcome.IGNORED
    return len(expired)


def _latest_attributable_delivery(db: Session, user_id: int, moment: datetime) -> NotificationDelivery | None:
    candidates = db.scalars(
        select(NotificationDelivery)
        .where(
            NotificationDelivery.user_id == user_id,
            NotificationDelivery.session_id.is_(None),
            NotificationDelivery.outcome == DeliveryOutcome.PENDING,
            NotificationDelivery.notification_type.not_in(TRANSACTIONAL_TYPES),
            NotificationDelivery.sent_at >= moment - ATTRIBUTION_WINDOW,
            NotificationDelivery.sent_at <= moment,
        )
        .order_by(NotificationDelivery.sent_at.desc())
        .limit(1)
    ).all()
    return candidates[0] if candidates else None
