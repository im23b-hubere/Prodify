from dataclasses import dataclass
from datetime import timedelta

from app.models import User, utcnow
from app.services.screenshot_seed_service import (
    SCREENSHOT_FRIENDS,
    _clear_main_friendships,
    _clear_user_sessions,
    _ensure_friendship_accepted,
    _ensure_premium,
    _ensure_progression,
    _ensure_streak,
    _ensure_user,
    _ensure_weekly_goal,
    _seed_realistic_sessions,
    _seed_session_count,
)


@dataclass(frozen=True)
class ScreenshotSeedResult:
    main_email: str
    main_username: str
    main_user_id: int
    sessions_created: int
    current_streak: int
    longest_streak: int
    friends_seeded: int
    premium_enabled: bool


@dataclass(frozen=True)
class MainSeedConfig:
    email: str
    username: str
    password: str
    days_back: int
    current_streak: int
    longest_streak: int
    level: int


def seed_screenshot_account(
    db,
    *,
    main_email: str = "eric.huber.ch@gmail.com",
    main_username: str = "erix",
    main_password: str = "demo123456",
    friend_password: str = "demo123456",
    days_back: int = 84,
    current_streak: int = 52,
    longest_streak: int = 71,
    main_level: int = 24,
) -> ScreenshotSeedResult:
    config = MainSeedConfig(
        email=main_email,
        username=main_username,
        password=main_password,
        days_back=days_back,
        current_streak=current_streak,
        longest_streak=longest_streak,
        level=main_level,
    )
    main_user, sessions_created = _seed_main_account(db, config)
    friends_seeded = _seed_friends(db, main_user.id, friend_password)
    db.commit()
    return ScreenshotSeedResult(
        main_email=config.email,
        main_username=config.username,
        main_user_id=main_user.id,
        sessions_created=sessions_created,
        current_streak=config.current_streak,
        longest_streak=config.longest_streak,
        friends_seeded=friends_seeded,
        premium_enabled=True,
    )


def _seed_main_account(db, config: MainSeedConfig) -> tuple[User, int]:
    main_user = _ensure_user(
        db,
        email=config.email,
        username=config.username,
        password=config.password,
        reset_password=True,
    )
    _clear_main_friendships(db, main_user.id)
    _clear_user_sessions(db, main_user.id)
    sessions_created = _seed_realistic_sessions(
        db,
        main_user.id,
        days_back=config.days_back,
        sessions_per_day=2,
        base_minutes=48,
    )
    streak = _ensure_streak(db, main_user.id)
    streak.current_streak = config.current_streak
    streak.longest_streak = max(config.longest_streak, config.current_streak)
    streak.last_session_date = utcnow()
    streak.freezes_remaining = 3
    _ensure_progression(db, main_user.id, level=config.level, xp_total=2840, xp_to_next=210)
    _ensure_weekly_goal(db, main_user.id, target=7)
    _ensure_premium(db, main_user.id)
    return main_user, sessions_created


def _seed_friends(db, main_user_id: int, friend_password: str) -> int:
    for index, friend_data in enumerate(SCREENSHOT_FRIENDS):
        _seed_friend(db, main_user_id, friend_password, friend_data, index)
    return len(SCREENSHOT_FRIENDS)


def _seed_friend(db, main_user_id: int, password: str, friend_data: tuple, index: int) -> None:
    username, email, streak_days, level, session_count = friend_data
    friend = _ensure_user(db, email=email, username=username, password=password)
    _ensure_friendship_accepted(db, main_user_id, friend.id)
    _clear_user_sessions(db, friend.id)
    _seed_friend_activity(db, friend, streak_days, level, session_count, index)


def _seed_friend_activity(
    db,
    friend: User,
    streak_days: int,
    level: int,
    session_count: int | None,
    index: int,
) -> None:
    base_minutes = 34 + level
    if session_count is not None:
        _seed_session_count(db, friend.id, count=session_count, base_minutes=base_minutes)
    else:
        _seed_realistic_sessions(
            db,
            friend.id,
            days_back=28 + (level % 6),
            sessions_per_day=1,
            base_minutes=base_minutes,
        )
    streak = _ensure_streak(db, friend.id)
    streak.current_streak = streak_days
    streak.longest_streak = max(int(streak.longest_streak or 0), streak_days + 4)
    streak.last_session_date = utcnow() - timedelta(hours=2 + index * 5)
    _ensure_progression(
        db,
        friend.id,
        level=level,
        xp_total=420 + level * 95,
        xp_to_next=140,
    )
