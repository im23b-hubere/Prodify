"""UTC-window streak-at-risk reminders (server push). Run: python -m app.jobs.send_streak_reminders"""

from __future__ import annotations

import logging
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
        return {
            "utc_day_key": day_key,
            "slot": None,
            "reminders_sent": 0,
            "users_with_tokens": 0,
            "skipped_outside_window": True,
            "message": "Current UTC time is outside streak reminder windows.",
        }

    user_ids = list(db.scalars(select(PushToken.user_id).distinct()).all())
    reminders_sent = 0
    skipped_dedupe = 0
    skipped_not_at_risk = 0

    for uid in user_ids:
        exists = db.scalar(
            select(StreakReminderDispatchLog.id).where(
                StreakReminderDispatchLog.user_id == uid,
                StreakReminderDispatchLog.utc_day_key == day_key,
                StreakReminderDispatchLog.slot_kind == slot,
            )
        )
        if exists is not None:
            skipped_dedupe += 1
            continue

        cur, at_risk = streak_snapshot(db, uid)
        if not at_risk:
            skipped_not_at_risk += 1
            continue

        title, body = push_templates.streak_reminder_slot(slot, cur)
        data = {**push_data_dashboard(), "kind": slot}
        try:
            attempted, ok, msg = dispatch_to_user(settings, db, uid, title, body, data=data)
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("streak reminder push failed user_id=%s", uid)
            continue

        if ok > 0:
            db.add(
                StreakReminderDispatchLog(
                    user_id=uid,
                    utc_day_key=day_key,
                    slot_kind=slot,
                    created_at=utcnow(),
                )
            )
            db.commit()
            reminders_sent += 1
        elif attempted > 0 and msg:
            logger.info("streak reminder no delivery user_id=%s: %s", uid, msg)

    return {
        "utc_day_key": day_key,
        "slot": slot,
        "reminders_sent": reminders_sent,
        "users_with_tokens": len(user_ids),
        "skipped_already_sent_or_duplicate": skipped_dedupe,
        "skipped_not_at_risk": skipped_not_at_risk,
        "skipped_outside_window": False,
    }


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
