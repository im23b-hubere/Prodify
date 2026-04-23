from __future__ import annotations

import argparse
from datetime import timedelta

from sqlalchemy import or_, select

from app.database import SessionLocal
from app.models import Friendship, FriendshipStatus, ProductionSession, Streak, User, UserProgression, utcnow
from app.security import hash_password


def _norm_email(v: str) -> str:
    return v.strip().lower()


def _norm_username(v: str) -> str:
    return v.strip().lower()


def _ensure_user(db, *, email: str, username: str, password: str) -> User:
    email_n = _norm_email(email)
    username_n = _norm_username(username)
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


def _ensure_progression(db, user_id: int, *, level: int, xp_total: int, xp_to_next: int):
    row = db.scalar(select(UserProgression).where(UserProgression.user_id == user_id))
    if row is None:
        row = UserProgression(user_id=user_id)
        db.add(row)
        db.flush()
    row.current_level = int(level)
    row.xp_total = int(xp_total)
    row.xp_to_next_level = int(xp_to_next)
    row.updated_at = utcnow()


def _ensure_friendship_accepted(db, a: int, b: int):
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


def _seed_completed_sessions(db, user_id: int, *, days: int, minutes: int):
    now = utcnow()
    for i in range(days):
        start = now - timedelta(days=i, minutes=minutes + 5)
        stop = start + timedelta(minutes=minutes)
        db.add(
            ProductionSession(
                user_id=user_id,
                started_at=start,
                stopped_at=stop,
                duration_seconds=int(minutes * 60),
                session_type="beat_making",
                paused_duration_seconds=0,
            )
        )


def _ensure_active_session_older_than(db, user_id: int, *, min_minutes_running: int = 70):
    now = utcnow()
    active = db.scalar(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.stopped_at.is_(None),
        )
    )
    target_start = now - timedelta(minutes=min_minutes_running)
    if active is None:
        db.add(
            ProductionSession(
                user_id=user_id,
                started_at=target_start,
                stopped_at=None,
                duration_seconds=None,
                session_type="beat_making",
                paused_duration_seconds=0,
            )
        )
        return
    if active.started_at > target_start:
        active.started_at = target_start


def main():
    parser = argparse.ArgumentParser(description="Seed demo scene: friends + streak + active session.")
    parser.add_argument("--main-email", required=True)
    parser.add_argument("--main-username", default="erix")
    parser.add_argument("--main-password", default="demo123456")
    parser.add_argument("--friend-count", type=int, default=6)
    parser.add_argument("--friend-password", default="demo123456")
    parser.add_argument("--friend-prefix", default="demo_friend_")
    args = parser.parse_args()

    with SessionLocal() as db:
        main_user = _ensure_user(
            db,
            email=args.main_email,
            username=args.main_username,
            password=args.main_password,
        )

        # Main account: visually strong but still realistic.
        main_streak = _ensure_streak(db, main_user.id)
        main_streak.current_streak = 21
        main_streak.longest_streak = max(int(main_streak.longest_streak or 0), 28)
        main_streak.last_session_date = utcnow()
        _ensure_progression(db, main_user.id, level=24, xp_total=1840, xp_to_next=160)

        # Build meaningful history for stats + streak perception.
        _seed_completed_sessions(db, main_user.id, days=14, minutes=58)
        _ensure_active_session_older_than(db, main_user.id, min_minutes_running=72)

        # Friends for leaderboard/feed density.
        for i in range(1, args.friend_count + 1):
            uname = f"{args.friend_prefix}{i}"
            email = f"{args.friend_prefix}{i}@gmail.com"
            friend = _ensure_user(db, email=email, username=uname, password=args.friend_password)
            _ensure_friendship_accepted(db, main_user.id, friend.id)

            fs = _ensure_streak(db, friend.id)
            fs.current_streak = 7 + i
            fs.longest_streak = max(int(fs.longest_streak or 0), 10 + i)
            fs.last_session_date = utcnow() - timedelta(days=(i % 2))

            # Spread friend performance so leaderboard looks alive.
            _ensure_progression(
                db,
                friend.id,
                level=max(6, 14 - i),
                xp_total=max(380, 980 - i * 70),
                xp_to_next=140,
            )
            _seed_completed_sessions(db, friend.id, days=5 + (i % 3), minutes=35 + (i * 3))

        db.commit()

    print("Done. Demo scene seeded (friends accepted, streak and active session prepared).")


if __name__ == "__main__":
    main()
