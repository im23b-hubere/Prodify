from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.jobs.send_streak_reminders import run_streak_reminder_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/streak-reminders")
def http_run_streak_reminders(
    db: Annotated[Session, Depends(get_db)],
    x_internal_job_key: Annotated[str | None, Header(alias="X-Internal-Job-Key")] = None,
) -> dict:
    expected = (settings.internal_job_key or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="INTERNAL_JOB_KEY is not configured on the server.",
        )
    if (x_internal_job_key or "").strip() != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid job key.")
    return run_streak_reminder_job(db, settings)
