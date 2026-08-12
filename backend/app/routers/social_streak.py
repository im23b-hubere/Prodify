from __future__ import annotations

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.dependencies_subscription import user_has_premium_access
from app.models import BuddyStatus, ProductionSession, Streak, StreakRescue, User, utcnow
from app.contracts.social import BuddyRiskPublic, StreakRescueBody
from app.services.buddy_service import current_buddy_relationship, get_buddy_status
from app.services.friend_graph import friend_user_ids
from app.services.kpi_tracker import track_event
from app.services.push_dispatch import send_ping
from app.services.progression_service import grant_xp
from app.services.social_week_service import current_week_start
from app.streakutil import dump_frozen_json, parse_frozen_json


router = APIRouter()


@router.post("/streak/rescue", response_model=dict[str, str | int])
def rescue_streak(
    body: StreakRescueBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    buddy_user_id = _active_buddy_user_id(db, current.id)
    if body.rescued_user_id != buddy_user_id:
        raise HTTPException(status_code=403, detail="You can only rescue your buddy")

    today_key = utcnow().date().isoformat()
    if _was_rescued_on_day(db, buddy_user_id, today_key):
        raise HTTPException(status_code=400, detail="Buddy streak already rescued today")
    if _weekly_rescue_count(db, current.id) >= _weekly_rescue_limit(db, current):
        raise HTTPException(
            status_code=402,
            detail="Keep your creative run alive with Premium to unlock more saves.",
        )

    streak = db.scalar(select(Streak).where(Streak.user_id == buddy_user_id))
    if streak is None:
        raise HTTPException(status_code=404, detail="Buddy streak not found")
    frozen_days = parse_frozen_json(streak.frozen_day_keys)
    if today_key not in frozen_days:
        frozen_days.append(today_key)
        streak.frozen_day_keys = dump_frozen_json(frozen_days)

    db.add(StreakRescue(rescued_user_id=buddy_user_id, rescuer_user_id=current.id, day_key=today_key))
    grant_xp(
        db,
        current.id,
        12,
        source_type="social_streak_rescue",
        source_id=f"{buddy_user_id}:{today_key}",
        meta={"rescued_user_id": buddy_user_id, "day_key": today_key},
    )
    db.commit()
    return {"message": "Buddy streak rescued", "rescued_user_id": buddy_user_id}


@router.post("/streak/encourage", response_model=dict[str, str | int])
def encourage_streak_restart(
    body: StreakRescueBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    recipient = db.get(User, body.rescued_user_id)
    if recipient is None:
        raise HTTPException(status_code=404, detail="User not found")
    if recipient.id == current.id:
        raise HTTPException(status_code=400, detail="Cannot encourage yourself")
    if recipient.id not in set(friend_user_ids(db, current.id)):
        raise HTTPException(status_code=403, detail="You can only encourage friends")

    send_ping(
        settings,
        db,
        recipient.id,
        "Your crew has your back",
        f"{current.username} sent support after your streak break. Start fresh today.",
        data={"kind": "streak_encouragement", "from_user_id": str(current.id)},
    )
    track_event(
        db,
        "streak_encouragement_sent",
        user_id=current.id,
        props={"target_user_id": recipient.id},
    )
    db.commit()
    return {"message": "Encouragement sent", "rescued_user_id": recipient.id}


@router.get("/buddy/risk", response_model=BuddyRiskPublic)
def get_buddy_risk(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    buddy = get_buddy_status(db, current.id)
    if buddy.status != "active" or buddy.buddy_user_id is None:
        return BuddyRiskPublic()

    buddy_user_id = buddy.buddy_user_id
    today_key = utcnow().date().isoformat()
    streak = db.scalar(select(Streak).where(Streak.user_id == buddy_user_id))
    has_session_today = _has_completed_session_today(db, buddy_user_id)
    is_frozen_today = bool(streak and today_key in set(parse_frozen_json(streak.frozen_day_keys)))
    is_at_risk = bool(
        streak
        and int(streak.current_streak or 0) > 0
        and not has_session_today
        and not is_frozen_today
    )
    rescued_today = _was_rescued_on_day(db, buddy_user_id, today_key)
    rescue_available = (
        is_at_risk
        and not rescued_today
        and _weekly_rescue_count(db, current.id) < _weekly_rescue_limit(db, current)
    )
    return BuddyRiskPublic(
        buddy_user_id=buddy_user_id,
        buddy_username=buddy.buddy_username,
        buddy_streak_at_risk=is_at_risk,
        rescue_available=rescue_available,
        rescued_today=rescued_today,
    )


def _active_buddy_user_id(db: Session, user_id: int) -> int:
    relationship = current_buddy_relationship(db, user_id)
    if relationship is None or relationship.status != BuddyStatus.active:
        raise HTTPException(status_code=403, detail="Only active buddies can rescue streaks")
    return relationship.addressee_id if relationship.requester_id == user_id else relationship.requester_id


def _was_rescued_on_day(db: Session, user_id: int, day_key: str) -> bool:
    rescue = db.scalar(
        select(StreakRescue).where(
            StreakRescue.rescued_user_id == user_id,
            StreakRescue.day_key == day_key,
        )
    )
    return rescue is not None


def _weekly_rescue_count(db: Session, rescuer_user_id: int) -> int:
    rescues = db.scalars(select(StreakRescue).where(StreakRescue.rescuer_user_id == rescuer_user_id)).all()
    week_start = current_week_start()
    return sum(1 for rescue in rescues if _week_start_for_rescue(rescue) == week_start)


def _week_start_for_rescue(rescue: StreakRescue) -> str:
    rescue_date = rescue.created_at.date()
    return (rescue_date - timedelta(days=rescue_date.weekday())).isoformat()


def _weekly_rescue_limit(db: Session, user: User) -> int:
    premium_limit = 3 if user_has_premium_access(db, user) else 1
    return premium_limit + int(user.bonus_rescues or 0)


def _has_completed_session_today(db: Session, user_id: int) -> bool:
    start_of_today = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    session = db.scalar(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.started_at >= start_of_today,
        )
    )
    return session is not None
