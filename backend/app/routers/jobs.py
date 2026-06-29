import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.jobs.send_streak_reminders import run_streak_reminder_job
from app.schemas import SeedScreenshotAccountBody
from app.services.screenshot_seed_service import seed_screenshot_account

router = APIRouter(prefix="/jobs", tags=["jobs"])
_log = logging.getLogger(__name__)


def _require_internal_job_key(x_internal_job_key: str | None) -> None:
    expected = (settings.internal_job_key or "").strip()
    if not expected:
        _log.warning("internal_job_rejected reason=job_key_not_configured status=503")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "job_key_not_configured",
                "message": "INTERNAL_JOB_KEY is not configured on the server. Configure the secret, then retry.",
            },
        )
    if (x_internal_job_key or "").strip() != expected:
        _log.warning("internal_job_rejected reason=invalid_job_key status=401")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "invalid_job_key",
                "message": "Invalid X-Internal-Job-Key header.",
            },
        )


@router.post("/streak-reminders")
def http_run_streak_reminders(
    db: Annotated[Session, Depends(get_db)],
    x_internal_job_key: Annotated[str | None, Header(alias="X-Internal-Job-Key")] = None,
) -> dict:
    _require_internal_job_key(x_internal_job_key)
    return run_streak_reminder_job(db, settings)


@router.post("/seed-screenshot-account")
def http_seed_screenshot_account(
    db: Annotated[Session, Depends(get_db)],
    body: SeedScreenshotAccountBody | None = None,
    x_internal_job_key: Annotated[str | None, Header(alias="X-Internal-Job-Key")] = None,
) -> dict:
    """Seed realistic streak/sessions/friends for App Store screenshots (idempotent)."""
    _require_internal_job_key(x_internal_job_key)
    opts = body or SeedScreenshotAccountBody()
    result = seed_screenshot_account(
        db,
        main_email=opts.main_email,
        main_username=opts.main_username,
        main_password=opts.main_password,
        friend_password=opts.friend_password,
        days_back=opts.days_back,
        current_streak=opts.current_streak,
        longest_streak=opts.longest_streak,
        main_level=opts.main_level,
    )
    return {
        "status": "ok",
        "main_email": result.main_email,
        "main_username": result.main_username,
        "main_user_id": result.main_user_id,
        "sessions_created": result.sessions_created,
        "current_streak": result.current_streak,
        "longest_streak": result.longest_streak,
        "friends_seeded": result.friends_seeded,
        "premium_enabled": result.premium_enabled,
    }
