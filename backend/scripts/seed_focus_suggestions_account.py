"""Seed an account whose skill history triggers every focus-suggestion reason.

Expected suggestions in the session setup:
  Mixing / Mix & Master / Learning: "EQ" (20m to level 3) + "Saturation" (resting 30 days)
  Beat Making:                      "Drums" (keep going) + "Groove" (new skill to unlock)
  Recording:                        "Room" (resting 20 days) + "Mic technique" (new skill)
  Mastering and the rest:           two new skills to unlock

Destructive: the account's password is reset and its sessions are replaced. Credentials must
be passed explicitly, so the script cannot take over a real account by accident.
"""

from __future__ import annotations

import argparse
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.models import ProductionSession, SessionSkillFocus, utcnow
from app.services.screenshot_seed_service import _clear_user_sessions, _ensure_user

# (focus, minutes, days ago). One focus per session, so it earns the whole duration.
SEEDED_PRACTICE: tuple[tuple[str, int, int], ...] = (
    ("mixing.eq", 80, 12),
    ("mixing.eq", 80, 10),
    ("mixing.saturation", 90, 30),
    ("beat_making.drums", 90, 1),
    ("recording.room", 70, 20),
)


def seed_practice(db, user_id: int) -> int:
    now = utcnow()
    for focus_id, minutes, days_ago in SEEDED_PRACTICE:
        started_at = now - timedelta(days=days_ago, hours=2)
        session = ProductionSession(
            user_id=user_id,
            started_at=started_at,
            stopped_at=started_at + timedelta(minutes=minutes),
            duration_seconds=minutes * 60,
            session_type=focus_id.split(".", 1)[0],
            paused_duration_seconds=0,
        )
        session.skill_focuses = [SessionSkillFocus(skill_id=focus_id, is_primary=True)]
        db.add(session)
    return len(SEEDED_PRACTICE)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed an account for testing focus suggestions.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    with SessionLocal() as db:
        user = _ensure_user(
            db,
            email=args.email,
            username=args.username,
            password=args.password,
            reset_password=True,
        )
        _clear_user_sessions(db, user.id)
        created = seed_practice(db, user.id)
        db.commit()
        print(f"Seeded {created} sessions for {user.email} (@{user.username}, id={user.id}).")


if __name__ == "__main__":
    main()
