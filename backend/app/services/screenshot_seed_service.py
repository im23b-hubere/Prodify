"""Seed realistic demo data for App Store screenshots (main account + friends)."""

from __future__ import annotations

import json
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

SCREENSHOT_FRIENDS: list[tuple[str, str, int, int, int | None]] = [
    # (username, email, current_streak, progression_level, total_sessions)
    ("nico.beats", "nico.beats.studio@gmail.com", 18, 17, 24),
    ("lena.wav", "lena.wav.music@gmail.com", 14, 15, 17),
    ("marcus808", "marcus808.prod@gmail.com", 22, 21, None),
    ("kira.mix", "kira.mix.audio@gmail.com", 11, 13, None),
    ("felix.arr", "felix.arrange@gmail.com", 9, 12, None),
    ("sofia.sounds", "sofia.sounds.studio@gmail.com", 31, 26, None),
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


def _seed_session_count(
    db,
    user_id: int,
    *,
    count: int,
    base_minutes: int,
) -> int:
    """Spread exactly `count` completed sessions over recent days (screenshot-friendly)."""
    if count <= 0:
        return 0
    now = utcnow()
    session_types = ("beat_making", "mixing", "sound_design", "arrangement")
    for i in range(count):
        day_offset = count - i
        minutes = base_minutes + (i % 4) * 8
        hour = 10 + (i % 3) * 2
        start = (now - timedelta(days=day_offset)).replace(
            hour=hour, minute=18 + (i % 5) * 6, second=0, microsecond=0
        )
        stop = start + timedelta(minutes=minutes)
        finished = i % 3 != 1
        title_idx = i % len(TRACK_TITLES)
        db.add(
            ProductionSession(
                user_id=user_id,
                started_at=start,
                stopped_at=stop,
                duration_seconds=max(420, int(minutes * 60)),
                session_type=session_types[i % len(session_types)],
                notes=SESSION_NOTES[i % len(SESSION_NOTES)],
                mood_level=3 + (i % 3),
                tags=json.dumps(SESSION_TAGS[i % len(SESSION_TAGS)]),
                paused_duration_seconds=0,
                focus_score=70 + (i % 25),
                track_outcome="finished" if finished else "wip",
                track_title=TRACK_TITLES[title_idx] if finished else None,
            )
        )
    return count


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


