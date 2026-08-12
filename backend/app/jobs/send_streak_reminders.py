"""UTC-window streak-at-risk reminders (server push). Run: python -m app.jobs.send_streak_reminders"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.config import Settings
from app.models import PushToken, StreakReminderDispatchLog, utcnow
from app.services import push_templates
from app.services.push_dispatch import dispatch_to_user
from app.services.push_links import push_data_dashboard
from app.services.streak_state import streak_snapshot

logger = logging.getLogger(__name__)

SLOT_STREAK_UTC_22 = "streak_utc_22"
SLOT_STREAK_UTC_23 = "streak_utc_23"
SLOT_STREAK_UTC_2330 = "streak_utc_2330"


@dataclass
class ReminderCounts:
    sent: int = 0
    duplicate: int = 0
    not_at_risk: int = 0

    def record(self, outcome: str) -> None:
        if outcome == "sent":
            self.sent += 1
        elif outcome == "duplicate":
            self.duplicate += 1
        elif outcome == "not_at_risk":
            self.not_at_risk += 1


def pick_reminder_slot(now_utc: datetime) -> str | None:
    """Return slot_kind if now falls in a reminder window, else None."""
    h, m = now_utc.hour, now_utc.minute
    if h == 22 and m <= 20:
        return SLOT_STREAK_UTC_22
    if h == 23 and m <= 15:
        return SLOT_STREAK_UTC_23
    if h == 23 and 25 <= m <= 45:
        return SLOT_STREAK_UTC_2330
    return None


def run_streak_reminder_job(db: DBSession, settings: Settings) -> dict:
    """
    For users with push tokens: if streak at risk (UTC) and not already reminded this slot, send push.
    """
    now = utcnow().astimezone(timezone.utc)
    slot = pick_reminder_slot(now)
    day_key = now.date().isoformat()

    if slot is None:
        return _outside_window_result(day_key)

    user_ids = list(db.scalars(select(PushToken.user_id).distinct()).all())
    counts = ReminderCounts()
    for user_id in user_ids:
        counts.record(_process_user(db, settings, user_id, day_key, slot))
    return {
        "utc_day_key": day_key,
        "slot": slot,
        "reminders_sent": counts.sent,
        "users_with_tokens": len(user_ids),
        "skipped_already_sent_or_duplicate": counts.duplicate,
        "skipped_not_at_risk": counts.not_at_risk,
        "skipped_outside_window": False,
    }


def _outside_window_result(day_key: str) -> dict:
    return {
        "utc_day_key": day_key,
        "slot": None,
        "reminders_sent": 0,
        "users_with_tokens": 0,
        "skipped_outside_window": True,
        "message": "Current UTC time is outside streak reminder windows.",
    }


def _process_user(
    db: DBSession,
    settings: Settings,
    user_id: int,
    day_key: str,
    slot: str,
) -> str:
    if _was_already_reminded(db, user_id, day_key, slot):
        return "duplicate"
    current_streak, at_risk = streak_snapshot(db, user_id)
    if not at_risk:
        return "not_at_risk"
    return "sent" if _send_reminder(db, settings, user_id, day_key, slot, current_streak) else "failed"


def _was_already_reminded(db: DBSession, user_id: int, day_key: str, slot: str) -> bool:
    return (
        db.scalar(
            select(StreakReminderDispatchLog.id).where(
                StreakReminderDispatchLog.user_id == user_id,
                StreakReminderDispatchLog.utc_day_key == day_key,
                StreakReminderDispatchLog.slot_kind == slot,
            )
        )
        is not None
    )


def _send_reminder(
    db: DBSession,
    settings: Settings,
    user_id: int,
    day_key: str,
    slot: str,
    current_streak: int,
) -> bool:
    title, body = push_templates.streak_reminder_slot(slot, current_streak)
    try:
        attempted, delivered, message = dispatch_to_user(
            settings,
            db,
            user_id,
            title,
            body,
            data={**push_data_dashboard(), "kind": slot},
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("streak reminder push failed user_id=%s", user_id)
        return False
    if delivered <= 0:
        if attempted > 0 and message:
            logger.info("streak reminder no delivery user_id=%s: %s", user_id, message)
        return False
    db.add(
        StreakReminderDispatchLog(
            user_id=user_id,
            utc_day_key=day_key,
            slot_kind=slot,
            created_at=utcnow(),
        )
    )
    db.commit()
    return True


def main() -> None:
    from app.database import SessionLocal
    from app.config import settings as app_settings

    db = SessionLocal()
    try:
        out = run_streak_reminder_job(db, app_settings)
        print(out)
    finally:
        db.close()


if __name__ == "__main__":
    main()
