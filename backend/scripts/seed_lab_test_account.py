"""Seed a lab account with screenshot-scale history plus tree, challenges, and social extras.

Destructive for the target user: password reset, sessions and friendships replaced.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.contracts.social import SocialChallengeCreateBody
from app.database import SessionLocal
from app.models import ProductionSession, SessionAreaWeight, SessionSkillFocus, User
from app.skill_catalog import SKILL_FOCUSES_BY_BRANCH
from app.services.buddy_service import accept_buddy_invite, invite_buddy
from app.services.screenshot_seed_scenario import seed_screenshot_account
from app.services.screenshot_seed_service import SCREENSHOT_FRIENDS, _ensure_premium
from app.services.social_challenge_application_service import accept_challenge, create_challenge
from app.services.social_challenge_queries import challenge_members
from app.services.social_feed_service import add_session_comment, toggle_session_reaction


MAIN_EMAIL = "eric.lab@prodify.app"
MAIN_USERNAME = "eric.lab"
LAB_PASSWORD = os.environ.get("PRODIFY_LAB_PASSWORD", "").strip() or None


def decorate_sessions(db, user_id: int) -> None:
    sessions = list(
        db.scalars(
            select(ProductionSession)
            .where(ProductionSession.user_id == user_id)
            .order_by(ProductionSession.started_at.asc())
        )
    )
    for index, session in enumerate(sessions):
        if index % 11 == 0:
            session.session_type = "mix_and_master"
        elif index % 13 == 0:
            session.session_type = "production"
            session.area_weights = [
                SessionAreaWeight(branch="beat_making", weight=3),
                SessionAreaWeight(branch="mixing", weight=2),
            ]
        elif index % 17 == 0:
            session.session_type = "learning"
            session.skill_focuses = [
                SessionSkillFocus(skill_id="mixing.eq", is_primary=True),
                SessionSkillFocus(skill_id="mixing.saturation", is_primary=False),
            ]
            continue
        focuses = SKILL_FOCUSES_BY_BRANCH.get(session.session_type, ())
        if not focuses:
            continue
        primary = focuses[index % len(focuses)]
        secondary = focuses[(index + 2) % len(focuses)]
        session.skill_focuses = [
            SessionSkillFocus(skill_id=f"{session.session_type}.{primary}", is_primary=True)
        ]
        if secondary != primary:
            session.skill_focuses.append(
                SessionSkillFocus(skill_id=f"{session.session_type}.{secondary}", is_primary=False)
            )


def seed_social_extras(db, main: User) -> None:
    nico = db.scalar(select(User).where(User.username == "nico.beats"))
    marcus = db.scalar(select(User).where(User.username == "marcus808"))
    lena = db.scalar(select(User).where(User.username == "lena.wav"))
    if nico is None or marcus is None or lena is None:
        return

    team = create_challenge(
        db,
        main,
        SocialChallengeCreateBody(
            challenge_kind="team",
            title="Studio week together",
            target_sessions=10,
            duration_days=7,
            member_user_ids=[nico.id],
        ),
    )
    for member in challenge_members(db, team.id):
        member.progress_sessions = 4 if member.user_id == main.id else 3
    db.commit()

    invite = create_challenge(
        db,
        marcus,
        SocialChallengeCreateBody(
            challenge_kind="duel",
            title="Weekend dash",
            target_sessions=5,
            duration_days=7,
            member_user_ids=[main.id],
        ),
    )
    accept_challenge(db, main, invite.id)

    create_challenge(
        db,
        lena,
        SocialChallengeCreateBody(
            challenge_kind="duel",
            title="Night session race",
            target_sessions=6,
            duration_days=7,
            member_user_ids=[main.id],
        ),
    )

    status = invite_buddy(db, main.id, nico.id)
    if status.invite_id:
        accept_buddy_invite(db, nico.id, status.invite_id)

    recent = db.scalars(
        select(ProductionSession)
        .where(ProductionSession.user_id == main.id)
        .order_by(ProductionSession.started_at.desc())
        .limit(3)
    ).all()
    if recent:
        add_session_comment(db, recent[0].id, nico, "That low end is sitting much better.")
        toggle_session_reaction(db, recent[0].id, nico.id, "🔥")
        if len(recent) > 1:
            add_session_comment(db, recent[1].id, lena, "Keep this bounce.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a full lab account for device testing.")
    parser.add_argument("--email", default=MAIN_EMAIL)
    parser.add_argument("--username", default=MAIN_USERNAME)
    parser.add_argument("--password", default=LAB_PASSWORD, help="defaults to $PRODIFY_LAB_PASSWORD")
    parser.add_argument("--friend-password", default=None, help="defaults to --password")
    args = parser.parse_args()
    if not args.password:
        parser.error("set PRODIFY_LAB_PASSWORD or pass --password")
    args.friend_password = args.friend_password or args.password

    with SessionLocal() as db:
        result = seed_screenshot_account(
            db,
            main_email=args.email,
            main_username=args.username,
            main_password=args.password,
            friend_password=args.friend_password,
            days_back=84,
            current_streak=18,
            longest_streak=41,
            main_level=16,
        )
        main_user = db.get(User, result.main_user_id)
        if main_user is not None:
            main_user.timezone = "Europe/Berlin"
        decorate_sessions(db, result.main_user_id)
        for _username, email, *_rest in SCREENSHOT_FRIENDS:
            friend = db.scalar(select(User).where(User.email == email))
            if friend is not None:
                _ensure_premium(db, friend.id)
        db.commit()
        if main_user is not None:
            seed_social_extras(db, main_user)

    print("Lab account seeded.")
    print(f"  email:    {args.email}")
    print(f"  username: @{args.username}")
    print(f"  password: {args.password}")
    print(f"  sessions: {result.sessions_created}")
    print(f"  friends:  {result.friends_seeded} (same password)")
    print("  friend logins:")
    for username, email, *_rest in SCREENSHOT_FRIENDS:
        print(f"    {email}  @{username}")


if __name__ == "__main__":
    main()
