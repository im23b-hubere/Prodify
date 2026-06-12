"""Seed realistic demo data for App Store screenshots (main account + friends)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, or_, select

from app.models import (
    Friendship,
    FriendshipStatus,
    ProductionSession,
    Streak,
    User,
    UserGoal,
    UserProgression,
    UserSubscription,
    utcnow,
)
from app.security import hash_password

SCREENSHOT_FRIENDS: list[tuple[str, str, int, int]] = [
    # (username, email, current_streak, progression_level)
    ("nico.beats", "nico.beats.studio@gmail.com", 18, 17),
    ("lena.wav", "lena.wav.music@gmail.com", 14, 15),
    ("marcus808", "marcus808.prod@gmail.com", 22, 21),
    ("kira.mix", "kira.mix.audio@gmail.com", 11, 13),
    ("felix.arr", "felix.arrange@gmail.com", 9, 12),
    ("sofia.sounds", "sofia.sounds.studio@gmail.com", 31, 26),
]

TRACK_TITLES = [
    "Midnight Drive",
    "Neon Pulse",
    "Low End Theory",
    "Summer Fade",
    "808 Gospel",
    "Night Session",
    "Glass Horizon",
    "Sub Pressure",
]

SESSION_NOTES = [
    "Tightened the low end and bounced a rough mix.",
    "Added vocal chops and a new counter-melody.",
    "Final arrangement pass before export.",
    "Drum bus glue + parallel compression.",
    "Reference check on monitors, fixed stereo image.",
]

SESSION_TAGS = [
    ["mix", "low-end"],
    ["arrangement", "hooks"],
    ["sound-design", "textures"],
    ["master-prep", "bounce"],
    ["beat", "808"],
]


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


def _norm_email(v: str) -> str:
    return v.strip().lower()


def _week_start(d: datetime) -> str:
    local = d.astimezone(timezone.utc)
    monday = local.date() - timedelta(days=local.weekday())
    return monday.isoformat()


def _ensure_user(
    db,
    *,
    email: str,
    username: str,
    password: str,
    reset_password: bool = False,
) -> User:
    email_n = _norm_email(email)
    username_n = username.strip().lower()
    row = db.scalar(select(User).where(User.email == email_n))
    if row is not None:
        if row.username != username_n:
            row.username = username_n
        if reset_password:
            row.hashed_password = hash_password(password)
        return row
    row = User(
        email=email_n,
        username=username_n,
        hashed_password=hash_password(password),
    )
    db.add(row)
    db.flush()
    return row


def _ensure_streak(db, user_id: int) -> Streak:
    row = db.scalar(select(Streak).where(Streak.user_id == user_id))
    if row is None:
        row = Streak(user_id=user_id, current_streak=0, longest_streak=0)
        db.add(row)
        db.flush()
    return row


def _ensure_progression(db, user_id: int, *, level: int, xp_total: int, xp_to_next: int) -> None:
    row = db.scalar(select(UserProgression).where(UserProgression.user_id == user_id))
    if row is None:
        row = UserProgression(user_id=user_id)
        db.add(row)
        db.flush()
    row.current_level = int(level)
    row.xp_total = int(xp_total)
    row.xp_to_next_level = int(xp_to_next)
    row.updated_at = utcnow()


def _ensure_friendship_accepted(db, a: int, b: int) -> None:
    existing = db.scalar(
        select(Friendship).where(
            or_(
                (Friendship.user_id == a) & (Friendship.friend_id == b),
                (Friendship.user_id == b) & (Friendship.friend_id == a),
            )
        )
    )
    if existing is None:
        db.add(Friendship(user_id=a, friend_id=b, status=FriendshipStatus.accepted))
        return
    existing.status = FriendshipStatus.accepted


def _clear_user_sessions(db, user_id: int) -> None:
    db.execute(delete(ProductionSession).where(ProductionSession.user_id == user_id))


def _clear_main_friendships(db, main_user_id: int) -> None:
    db.execute(
        delete(Friendship).where(
            or_(
                Friendship.user_id == main_user_id,
                Friendship.friend_id == main_user_id,
            )
        )
    )


def _seed_realistic_sessions(
    db,
    user_id: int,
    *,
    days_back: int,
    sessions_per_day: int,
    base_minutes: int,
) -> int:
    now = utcnow()
    created = 0
    session_types = ("beat_making", "mixing", "sound_design", "arrangement")
    for day_offset in range(days_back, -1, -1):
        # Keep a long streak: skip only a few scattered off-days in the distant past.
        if day_offset > 14 and day_offset % 17 == 0:
            continue
        day_base = now - timedelta(days=day_offset)
        count = sessions_per_day if day_offset > 0 else min(sessions_per_day, 1)
        for slot in range(count):
            minutes = base_minutes + (day_offset % 5) * 6 + slot * 10
            hour = 9 + slot * 3 + (day_offset % 4)
            start = day_base.replace(hour=hour, minute=12 + slot * 7, second=0, microsecond=0)
            if start > now:
                continue
            stop = start + timedelta(minutes=minutes)
            if stop > now:
                stop = now - timedelta(minutes=3)
                start = stop - timedelta(minutes=minutes)
            finished = (day_offset + slot) % 3 == 0
            title_idx = (day_offset + slot) % len(TRACK_TITLES)
            db.add(
                ProductionSession(
                    user_id=user_id,
                    started_at=start,
                    stopped_at=stop,
                    duration_seconds=max(420, int((stop - start).total_seconds())),
                    session_type=session_types[(day_offset + slot) % len(session_types)],
                    notes=SESSION_NOTES[(day_offset + slot) % len(SESSION_NOTES)],
                    mood_level=3 + ((day_offset + slot) % 3),
                    tags=json.dumps(SESSION_TAGS[(day_offset + slot) % len(SESSION_TAGS)]),
                    paused_duration_seconds=0,
                    focus_score=72 + ((day_offset + slot * 3) % 23),
                    track_outcome="finished" if finished else "wip",
                    track_title=TRACK_TITLES[title_idx] if finished else None,
                )
            )
            created += 1
    return created


def _ensure_weekly_goal(db, user_id: int, target: int = 7) -> None:
    week = _week_start(utcnow())
    row = db.scalar(
        select(UserGoal).where(
            UserGoal.user_id == user_id,
            UserGoal.goal_type == "weekly_sessions",
            UserGoal.week_start == week,
        )
    )
    if row is None:
        db.add(
            UserGoal(
                user_id=user_id,
                goal_type="weekly_sessions",
                target_value=target,
                week_start=week,
            )
        )
        return
    row.target_value = target


def _ensure_premium(db, user_id: int) -> None:
    user = db.get(User, user_id)
    if user is None:
        return
    user.is_premium = 1
    user.premium_until = utcnow() + timedelta(days=365)
    row = db.scalar(select(UserSubscription).where(UserSubscription.user_id == user_id))
    if row is None:
        row = UserSubscription(
            user_id=user_id,
            provider="seed",
            entitlement="premium",
            trial_active=False,
            expires_at=user.premium_until,
            rc_app_user_id=str(user_id),
        )
        db.add(row)
        db.flush()
        return
    row.entitlement = "premium"
    row.trial_active = False
    row.expires_at = user.premium_until


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
    main_user = _ensure_user(
        db,
        email=main_email,
        username=main_username,
        password=main_password,
        reset_password=True,
    )
    _clear_main_friendships(db, main_user.id)
    _clear_user_sessions(db, main_user.id)
    sessions_created = _seed_realistic_sessions(
        db,
        main_user.id,
        days_back=days_back,
        sessions_per_day=2,
        base_minutes=48,
    )

    main_streak = _ensure_streak(db, main_user.id)
    main_streak.current_streak = current_streak
    main_streak.longest_streak = max(longest_streak, current_streak)
    main_streak.last_session_date = utcnow()
    main_streak.freezes_remaining = 3

    _ensure_progression(db, main_user.id, level=main_level, xp_total=2840, xp_to_next=210)
    _ensure_weekly_goal(db, main_user.id, target=7)
    _ensure_premium(db, main_user.id)

    friends_seeded = 0
    for username, email, friend_streak, friend_level in SCREENSHOT_FRIENDS:
        friend = _ensure_user(
            db,
            email=email,
            username=username,
            password=friend_password,
        )
        _ensure_friendship_accepted(db, main_user.id, friend.id)
        _clear_user_sessions(db, friend.id)
        _seed_realistic_sessions(
            db,
            friend.id,
            days_back=28 + (friend_level % 6),
            sessions_per_day=1,
            base_minutes=34 + friend_level,
        )
        fs = _ensure_streak(db, friend.id)
        fs.current_streak = friend_streak
        fs.longest_streak = max(int(fs.longest_streak or 0), friend_streak + 4)
        fs.last_session_date = utcnow() - timedelta(hours=2 + friends_seeded * 5)
        _ensure_progression(
            db,
            friend.id,
            level=friend_level,
            xp_total=420 + friend_level * 95,
            xp_to_next=140,
        )
        friends_seeded += 1

    db.commit()

    return ScreenshotSeedResult(
        main_email=main_email,
        main_username=main_username,
        main_user_id=main_user.id,
        sessions_created=sessions_created,
        current_streak=current_streak,
        longest_streak=longest_streak,
        friends_seeded=friends_seeded,
        premium_enabled=True,
    )
