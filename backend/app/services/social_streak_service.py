from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.contracts.social import BuddyRiskPublic
from app.dependencies_subscription import user_has_premium_access
from app.models import BuddyStatus, ProductionSession, Streak, StreakRescue, User, utcnow
from app.services.buddy_service import current_buddy_relationship, get_buddy_status
from app.services.friend_graph import friend_user_ids
from app.services.kpi_tracker import track_event
from app.services.progression_service import grant_xp
from app.services.push_dispatch import send_ping
from app.services.social_week_service import current_week_start
from app.streakutil import dump_frozen_json, parse_frozen_json


class SocialStreakError(ValueError):
    pass


class ActiveBuddyRequiredError(SocialStreakError):
    pass


class BuddyRescueTargetError(SocialStreakError):
    pass


class BuddyAlreadyRescuedError(SocialStreakError):
    pass


class WeeklyRescueLimitError(SocialStreakError):
    pass


class BuddyStreakNotFoundError(SocialStreakError):
    pass


class EncouragementUserNotFoundError(SocialStreakError):
    pass


class SelfEncouragementError(SocialStreakError):
    pass


class EncouragementFriendRequiredError(SocialStreakError):
    pass


def rescue_buddy_streak(
    db: Session,
    rescuer: User,
    rescued_user_id: int,
) -> dict[str, str | int]:
    buddy_user_id = _active_buddy_user_id(db, rescuer.id)
    if rescued_user_id != buddy_user_id:
        raise BuddyRescueTargetError
    today_key = utcnow().date().isoformat()
    if _was_rescued_on_day(db, buddy_user_id, today_key):
        raise BuddyAlreadyRescuedError
    if _weekly_rescue_count(db, rescuer.id) >= _weekly_rescue_limit(db, rescuer):
        raise WeeklyRescueLimitError
    streak = db.scalar(select(Streak).where(Streak.user_id == buddy_user_id))
    if streak is None:
        raise BuddyStreakNotFoundError
    frozen_days = parse_frozen_json(streak.frozen_day_keys)
    if today_key not in frozen_days:
        frozen_days.append(today_key)
        streak.frozen_day_keys = dump_frozen_json(frozen_days)
    db.add(
        StreakRescue(
            rescued_user_id=buddy_user_id,
            rescuer_user_id=rescuer.id,
            day_key=today_key,
        )
    )
    grant_xp(
        db,
        rescuer.id,
        12,
        source_type="social_streak_rescue",
        source_id=f"{buddy_user_id}:{today_key}",
        meta={"rescued_user_id": buddy_user_id, "day_key": today_key},
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise BuddyAlreadyRescuedError from error
    return {"message": "Buddy streak rescued", "rescued_user_id": buddy_user_id}


def encourage_streak_restart(
    db: Session,
    sender: User,
    recipient_user_id: int,
) -> dict[str, str | int]:
    recipient = db.get(User, recipient_user_id)
    if recipient is None:
        raise EncouragementUserNotFoundError
    if recipient.id == sender.id:
        raise SelfEncouragementError
    if recipient.id not in set(friend_user_ids(db, sender.id)):
        raise EncouragementFriendRequiredError
    send_ping(
        settings,
        db,
        recipient.id,
        "Your crew has your back",
        f"{sender.username} sent support after your streak break. Start fresh today.",
        data={"kind": "streak_encouragement", "from_user_id": str(sender.id)},
    )
    track_event(
        db,
        "streak_encouragement_sent",
        user_id=sender.id,
        props={"target_user_id": recipient.id},
    )
    db.commit()
    return {"message": "Encouragement sent", "rescued_user_id": recipient.id}


def get_buddy_risk(db: Session, user: User) -> BuddyRiskPublic:
    buddy = get_buddy_status(db, user.id)
    if buddy.status != "active" or buddy.buddy_user_id is None:
        return BuddyRiskPublic()
    buddy_user_id = buddy.buddy_user_id
    today_key = utcnow().date().isoformat()
    streak = db.scalar(select(Streak).where(Streak.user_id == buddy_user_id))
    is_frozen_today = bool(
        streak and today_key in set(parse_frozen_json(streak.frozen_day_keys))
    )
    is_at_risk = bool(
        streak
        and int(streak.current_streak or 0) > 0
        and not _has_completed_session_today(db, buddy_user_id)
        and not is_frozen_today
    )
    rescued_today = _was_rescued_on_day(db, buddy_user_id, today_key)
    rescue_available = (
        is_at_risk
        and not rescued_today
        and _weekly_rescue_count(db, user.id) < _weekly_rescue_limit(db, user)
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
        raise ActiveBuddyRequiredError
    return (
        relationship.addressee_id
        if relationship.requester_id == user_id
        else relationship.requester_id
    )


def _was_rescued_on_day(db: Session, user_id: int, day_key: str) -> bool:
    return db.scalar(
        select(StreakRescue).where(
            StreakRescue.rescued_user_id == user_id,
            StreakRescue.day_key == day_key,
        )
    ) is not None


def _weekly_rescue_count(db: Session, rescuer_user_id: int) -> int:
    rescues = db.scalars(
        select(StreakRescue).where(StreakRescue.rescuer_user_id == rescuer_user_id)
    ).all()
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
    return db.scalar(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.started_at >= start_of_today,
        )
    ) is not None
