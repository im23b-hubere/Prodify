"""
Engagement engine heartbeat. Run every 15-30 minutes: python -m app.jobs.run_engagement_engine
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session as DBSession

from app.config import Settings
from app.models import utcnow
from app.services.engagement.deliveries import settle_expired_deliveries


def run_engagement_job(db: DBSession, settings: Settings, now: datetime | None = None) -> dict:
    run_at = now or utcnow()
    settled = settle_expired_deliveries(db, run_at)
    db.commit()
    return {"deliveries_settled": settled}


def main() -> None:
    from app.config import settings as app_settings
    from app.database import SessionLocal

    with SessionLocal() as db:
        print(run_engagement_job(db, app_settings))


if __name__ == "__main__":
    main()
