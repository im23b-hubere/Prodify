"""Seed a main account with long streak, many sessions, premium, and demo friends (local DB)."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, or_, select

from app.database import SessionLocal
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


def _norm_email(v: str) -> str:
    return v.strip().lower()


def _week_start(d: datetime) -> str:
    local = d.astimezone(timezone.utc)
    monday = local.date() - timedelta(days=local.weekday())
    return monday.isoformat()


def _ensure_user(db, *, email: str, username: str, password: str) -> User:
    email_n = _norm_email(email)
    username_n = username.strip().lower()
    row = db.scalar(select(User).where(User.email == email_n))
    if row is not None:
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


def _seed_sessions(
    db,
    user_id: int,
    *,
    days_back: int,
    sessions_per_day: int = 1,
    base_minutes: int = 45,
) -> int:
    now = utcnow()
    created = 0
    session_types = ("beat_making", "mixing", "sound_design", "arrangement")
    for day_offset in range(days_back, -1, -1):
        day_base = now - timedelta(days=day_offset)
        count = sessions_per_day if day_offset > 0 else min(sessions_per_day, 1)
        for slot in range(count):
            minutes = base_minutes + (day_offset % 5) * 7 + slot * 12
            start = day_base.replace(hour=10 + slot * 4, minute=15, second=0, microsecond=0) - timedelta(
                days=0
            )
            if start > now:
                continue
            stop = start + timedelta(minutes=minutes)
            if stop > now:
                stop = now - timedelta(minutes=2)
                start = stop - timedelta(minutes=minutes)
            db.add(
                ProductionSession(
                    user_id=user_id,
                    started_at=start,
                    stopped_at=stop,
                    duration_seconds=max(300, int((stop - start).total_seconds())),
                    session_type=session_types[(day_offset + slot) % len(session_types)],
                    notes=f"Demo session d-{day_offset} s-{slot}",
                    mood_level=3 + (day_offset % 3),
                    tags=json.dumps(["demo", "seed"]),
                    paused_duration_seconds=0,
                    track_outcome="finished" if day_offset % 4 == 0 else "wip",
                    track_title=f"Track {day_offset}-{slot}" if day_offset % 4 == 0 else None,
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed rich test data for a main account.")
    parser.add_argument("--main-email", default="eric.huber.ch@gmail.com")
    parser.add_argument("--main-username", default="erix")
    parser.add_argument("--main-password", default="demo123456")
    parser.add_argument("--friend-count", type=int, default=8)
    parser.add_argument("--friend-password", default="demo123456")
    parser.add_argument("--friend-prefix", default="demo_friend_")
    parser.add_argument("--days-back", type=int, default=90)
    parser.add_argument("--current-streak", type=int, default=47)
    parser.add_argument("--longest-streak", type=int, default=63)
    args = parser.parse_args()

    with SessionLocal() as db:
        main_user = _ensure_user(
            db,
            email=args.main_email,
            username=args.main_username,
            password=args.main_password,
        )
        _clear_user_sessions(db, main_user.id)
        main_created = _seed_sessions(
            db,
            main_user.id,
            days_back=args.days_back,
            sessions_per_day=2 if args.days_back >= 60 else 1,
            base_minutes=52,
        )

        main_streak = _ensure_streak(db, main_user.id)
        main_streak.current_streak = args.current_streak
        main_streak.longest_streak = max(args.longest_streak, args.current_streak)
        main_streak.last_session_date = utcnow()
        main_streak.freezes_remaining = 5

        _ensure_progression(db, main_user.id, level=28, xp_total=3200, xp_to_next=180)
        _ensure_weekly_goal(db, main_user.id, target=7)
        _ensure_premium(db, main_user.id)

        friends_created = 0
        for i in range(1, args.friend_count + 1):
            uname = f"{args.friend_prefix}{i}"
            email = f"{args.friend_prefix}{i}@gmail.com"
            friend = _ensure_user(db, email=email, username=uname, password=args.friend_password)
            _ensure_friendship_accepted(db, main_user.id, friend.id)

            _clear_user_sessions(db, friend.id)
            friend_sessions = _seed_sessions(
                db,
                friend.id,
                days_back=21 + (i % 5),
                sessions_per_day=1,
                base_minutes=30 + i * 4,
            )
            fs = _ensure_streak(db, friend.id)
            fs.current_streak = 5 + i * 2
            fs.longest_streak = max(int(fs.longest_streak or 0), 8 + i * 2)
            fs.last_session_date = utcnow() - timedelta(hours=i * 3)
            _ensure_progression(
                db,
                friend.id,
                level=10 + i,
                xp_total=600 + i * 120,
                xp_to_next=150,
            )
            friends_created += 1
            if i == 1:
                print(f"  friend sample: {uname} / {email} ({friend_sessions} sessions)")

        db.commit()

    print("Rich test account seeded.")
    print(f"  main: {args.main_email} (@{args.main_username})")
    print(f"  sessions created (main): {main_created}")
    print(f"  streak: {args.current_streak} current / {args.longest_streak} longest")
    print(f"  friends: {friends_created}")
    print(f"  premium: enabled")


if __name__ == "__main__":
    main()
