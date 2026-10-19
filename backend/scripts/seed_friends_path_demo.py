"""Add friends with varied (and shared) XP levels for rank-path marker testing.

Non-destructive for sessions. Upserts demo friend accounts and accepted friendships.
Optionally resets the main account password when --main-password is set.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.database import SessionLocal
from app.models import User, UserProgression
from app.security import hash_password
from app.services.friend_graph import friend_user_ids
from app.services.screenshot_seed_service import (
    _ensure_friendship_accepted,
    _ensure_progression,
    _ensure_user,
)

# (username, email, level) — duplicates on purpose for cluster / +N UI
PATH_DEMO_FRIENDS: list[tuple[str, str, int]] = [
    ("path.nova", "path.nova@prodify.app", 3),
    ("path.atlas", "path.atlas@prodify.app", 5),
    ("path.rio", "path.rio@prodify.app", 5),
    ("path.kira", "path.kira@prodify.app", 5),
    ("path.milo", "path.milo@prodify.app", 5),  # 4th at Lv5 → stack + +1
    ("path.zane", "path.zane@prodify.app", 8),
    ("path.lux", "path.lux@prodify.app", 12),
    ("path.aria", "path.aria@prodify.app", 12),
    ("path.orin", "path.orin@prodify.app", 18),
    ("path.summit", "path.summit@prodify.app", 20),
]

FRIEND_PASSWORD_DEFAULT = "PathDemo-Friends-2026!"


def _xp_for_level(level: int) -> int:
    # Match progression floor: (level - 1)^2 * 50
    safe = max(1, min(20, level))
    return (safe - 1) ** 2 * 50


def seed_path_demo(
    *,
    main_email: str,
    main_password: str | None,
    friend_password: str,
    main_level: int,
) -> None:
    email = main_email.strip().lower()
    with SessionLocal() as db:
        main = db.scalar(select(User).where(User.email == email))
        if main is None:
            raise SystemExit(f"Main account not found: {email}")

        if main_password:
            main.hashed_password = hash_password(main_password)

        _ensure_progression(
            db,
            main.id,
            level=main_level,
            xp_total=_xp_for_level(main_level) + 40,
            xp_to_next=80,
        )

        seeded: list[tuple[str, int]] = []
        for username, friend_email, level in PATH_DEMO_FRIENDS:
            friend = _ensure_user(
                db,
                email=friend_email,
                username=username,
                password=friend_password,
                reset_password=True,
            )
            _ensure_friendship_accepted(db, main.id, friend.id)
            _ensure_progression(
                db,
                friend.id,
                level=level,
                xp_total=_xp_for_level(level) + 25,
                xp_to_next=90,
            )
            seeded.append((username, level))

        db.commit()

        friend_ids = friend_user_ids(db, main.id)
        print(f"Main: {main.email} (@{main.username}, id={main.id})")
        print(f"Main level set to: {main_level}")
        if main_password:
            print(f"Main password reset to the value you passed.")
        print(f"Accepted friends now: {len(friend_ids)}")
        print("Path-demo friends:")
        for username, level in seeded:
            print(f"  @{username}  Lv {level}")
        print(f"Friend accounts password: {friend_password}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed friends for rank-path marker QA.")
    parser.add_argument("--main-email", default="testhubere@prodify.app")
    parser.add_argument(
        "--main-password",
        default=None,
        help="If set, resets the main account password (needed when switching Expo to local API).",
    )
    parser.add_argument("--friend-password", default=FRIEND_PASSWORD_DEFAULT)
    parser.add_argument("--main-level", type=int, default=10)
    args = parser.parse_args()
    seed_path_demo(
        main_email=args.main_email,
        main_password=args.main_password,
        friend_password=args.friend_password,
        main_level=args.main_level,
    )


if __name__ == "__main__":
    main()
