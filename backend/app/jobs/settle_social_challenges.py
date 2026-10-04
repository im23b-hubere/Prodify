"""Finishes expired challenges and invites so results land without anyone opening the app.

Run: python -m app.jobs.settle_social_challenges
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.models import SocialChallenge
from app.services.social_challenge_application_service import OPEN_STATUSES, settle_due_challenges
from app.services.social_challenge_events import ChallengeEvents


def run_social_challenge_job(db: DBSession, events: ChallengeEvents) -> dict:
    open_challenges = list(db.scalars(select(SocialChallenge).where(SocialChallenge.status.in_(OPEN_STATUSES))).all())
    settled = settle_due_challenges(db, open_challenges)
    db.commit()
    settled.announce(events)
    return {
        "checked": len(open_challenges),
        "finished": len(settled.finished_ids),
        "expired_invites": len(settled.expired_invite_ids),
    }


def main() -> None:
    from app.config import settings
    from app.database import SessionLocal
    from app.services.social_challenge_notifications import PushChallengeEvents

    with SessionLocal() as db:
        print(run_social_challenge_job(db, PushChallengeEvents(db, settings)))


if __name__ == "__main__":
    main()
