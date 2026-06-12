"""Seed screenshot-ready data for the main account (streak, friends, sessions, premium)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.services.screenshot_seed_service import seed_screenshot_account


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed realistic screenshot data for the main account.")
    parser.add_argument("--main-email", default="eric.huber.ch@gmail.com")
    parser.add_argument("--main-username", default="erix")
    parser.add_argument("--main-password", default="demo123456")
    parser.add_argument("--friend-password", default="demo123456")
    parser.add_argument("--days-back", type=int, default=84)
    parser.add_argument("--current-streak", type=int, default=52)
    parser.add_argument("--longest-streak", type=int, default=71)
    parser.add_argument("--main-level", type=int, default=24)
    args = parser.parse_args()

    with SessionLocal() as db:
        result = seed_screenshot_account(
            db,
            main_email=args.main_email,
            main_username=args.main_username,
            main_password=args.main_password,
            friend_password=args.friend_password,
            days_back=args.days_back,
            current_streak=args.current_streak,
            longest_streak=args.longest_streak,
            main_level=args.main_level,
        )

    print("Screenshot account seeded.")
    print(f"  main: {result.main_email} (@{result.main_username}, id={result.main_user_id})")
    print(f"  sessions created (main): {result.sessions_created}")
    print(f"  streak: {result.current_streak} current / {result.longest_streak} longest")
    print(f"  friends: {result.friends_seeded}")
    print(f"  premium: {'enabled' if result.premium_enabled else 'off'}")


if __name__ == "__main__":
    main()
