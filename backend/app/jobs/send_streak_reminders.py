"""
Streak-at-risk reminders in each producer's local evening (server push).

Run every ~15 minutes: python -m app.jobs.send_streak_reminders
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, time

from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.config import Settings
from app.models import PushToken, StreakReminderDispatchLog, User, utcnow
from app.services import push_templates
from app.services.engagement.preferences import is_push_allowed
from app.services.push_dispatch import dispatch_to_user
from app.services.push_links import push_data_dashboard
from app.services.streak_state import streak_snapshot
from app.timeutil import in_zone, resolve_timezone

logger = logging.getLogger(__name__)

SLOT_TWO_HOURS_LEFT = "streak_2h_left"
SLOT_ONE_HOUR_LEFT = "streak_1h_left"
SLOT_HALF_HOUR_LEFT = "streak_30m_left"

# Local wall-clock windows. Each is wider than the job interval so every slot is hit once.
_SLOT_WINDOWS: tuple[tuple[time, time, str], ...] = (
    (time(22, 0), time(22, 20), SLOT_TWO_HOURS_LEFT),
    (time(23, 0), time(23, 15), SLOT_ONE_HOUR_LEFT),
    (time(23, 25), time(23, 45), SLOT_HALF_HOUR_LEFT),
)


@dataclass
class ReminderCounts:
    sent: int = 0
    duplicate: int = 0
    not_at_risk: int = 0
    outside_window: int = 0
    muted: int = 0

    def record(self, outcome: str) -> None:
        if outcome == "sent":
            self.sent += 1
        elif outcome == "duplicate":
            self.duplicate += 1
        elif outcome == "not_at_risk":
            self.not_at_risk += 1
        elif outcome == "outside_window":
            self.outside_window += 1
        elif outcome == "muted":
            self.muted += 1


def pick_reminder_slot(local_now: datetime) -> str | None:
    """Return the slot for a local wall-clock time, or None outside every reminder window."""
    wall_clock = local_now.time()
    for start, end, slot in _SLOT_WINDOWS:
        if start <= wall_clock <= end:
            return slot
    return None


def run_streak_reminder_job(db: DBSession, settings: Settings, now: datetime | None = None) -> dict:
    """For reachable users whose local evening is in a slot: remind once if their streak is at risk."""
    run_at = now or utcnow()
    users = _reachable_users(db)
    counts = ReminderCounts()
    for user_id, zone_name in users:
        counts.record(_process_user(db, settings, user_id, zone_name, run_at))
    return {
        "reminders_sent": counts.sent,
        "users_with_tokens": len(users),
        "skipped_already_sent_or_duplicate": counts.duplicate,
        "skipped_not_at_risk": counts.not_at_risk,
        "skipped_outside_window": counts.outside_window,
        "skipped_muted": counts.muted,
    }


def _reachable_users(db: DBSession) -> list[tuple[int, str | None]]:
    rows = db.execute(
        select(User.id, User.timezone)
        .join(PushToken, PushToken.user_id == User.id)
        .where(PushToken.is_active == 1)
        .distinct()
    ).all()
    return [(user_id, zone_name) for user_id, zone_name in rows]


def _process_user(
    db: DBSession,
    settings: Settings,
    user_id: int,
    zone_name: str | None,
    run_at: datetime,
) -> str:
    local_now = in_zone(run_at, resolve_timezone(zone_name))
    slot = pick_reminder_slot(local_now)
    if slot is None:
        return "outside_window"
    if not is_push_allowed(db, user_id, slot, run_at):
        return "muted"
    day_key = local_now.date().isoformat()
    if _was_already_reminded(db, user_id, day_key, slot):
        return "duplicate"
    current_streak, at_risk = streak_snapshot(db, user_id, today=local_now.date())
    if not at_risk:
        return "not_at_risk"
    sent = _send_reminder(db, settings, user_id, day_key, slot, current_streak, run_at)
    return "sent" if sent else "failed"


def _was_already_reminded(db: DBSession, user_id: int, day_key: str, slot: str) -> bool:
    return (
        db.scalar(
            select(StreakReminderDispatchLog.id).where(
                StreakReminderDispatchLog.user_id == user_id,
                StreakReminderDispatchLog.day_key == day_key,
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
    run_at: datetime,
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
            now=run_at,
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
            day_key=day_key,
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
