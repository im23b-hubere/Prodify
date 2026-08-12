from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CheckinLog, CheckinPlan, User, utcnow
from app.contracts.social import CheckinDayStatePublic, CheckinStatusPublic
from app.services.progression_service import grant_xp
from app.services.social_week_service import current_week_start


def update_weekly_plan(db: Session, user_id: int, target_checkins: int) -> CheckinStatusPublic:
    week_start = current_week_start()
    plan = db.scalar(
        select(CheckinPlan).where(CheckinPlan.user_id == user_id, CheckinPlan.week_start == week_start)
    )
    if plan is None:
        plan = CheckinPlan(user_id=user_id, week_start=week_start)
        db.add(plan)
    plan.target_checkins = target_checkins
    db.commit()
    return get_status(db, user_id)


def complete_today(db: Session, user: User, note: str | None) -> CheckinStatusPublic:
    day_key = utcnow().date().isoformat()
    checkin = db.scalar(select(CheckinLog).where(CheckinLog.user_id == user.id, CheckinLog.day_key == day_key))
    is_first_completion = checkin is None or checkin.state != "done"
    if checkin is None:
        checkin = CheckinLog(user_id=user.id, day_key=day_key, state="done")
        db.add(checkin)
    checkin.state = "done"
    checkin.note = note
    if is_first_completion:
        grant_xp(
            db,
            user.id,
            6,
            source_type="social_checkin_done",
            source_id=day_key,
            meta={"day_key": day_key},
        )
    db.commit()
    return get_status(db, user.id)


def get_status(db: Session, user_id: int) -> CheckinStatusPublic:
    week_start = current_week_start()
    plan = db.scalar(
        select(CheckinPlan).where(CheckinPlan.user_id == user_id, CheckinPlan.week_start == week_start)
    )
    target_checkins = int(plan.target_checkins if plan else 3)
    today = utcnow().date()
    week_days = [(today - timedelta(days=today.weekday())) + timedelta(days=offset) for offset in range(7)]
    day_keys = [day.isoformat() for day in week_days]
    logs = db.scalars(select(CheckinLog).where(CheckinLog.user_id == user_id, CheckinLog.day_key.in_(day_keys))).all()
    completed_day_keys = {log.day_key for log in logs if log.state == "done"}
    day_states = [_day_state(day_key, today.isoformat(), completed_day_keys) for day_key in day_keys]
    completed_count = len(completed_day_keys)
    expected_count = min(target_checkins, max(1, today.weekday() + 1))
    return CheckinStatusPublic(
        week_start=week_start,
        target_checkins=target_checkins,
        done_count=completed_count,
        on_track=completed_count >= expected_count,
        day_states=day_states,
    )


def _day_state(day_key: str, today_key: str, completed_day_keys: set[str]) -> CheckinDayStatePublic:
    if day_key in completed_day_keys:
        state = "done"
    elif day_key >= today_key:
        state = "open"
    else:
        state = "missed"
    return CheckinDayStatePublic(day_key=day_key, state=state)
