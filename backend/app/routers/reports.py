from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.contracts.moderation import ReportCreate, ReportCreated
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services.content_report_service import (
    ReportLimitReachedError,
    ReportTargetNotFoundError,
    SelfReportError,
    report_comment,
    report_user,
)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", response_model=ReportCreated, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: ReportCreate,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        if payload.target_type == "comment":
            report = report_comment(db, settings, current.id, payload.comment_id, payload.reason, payload.note)
        else:
            report = report_user(db, settings, current.id, payload.user_id, payload.reason, payload.note)
    except ReportTargetNotFoundError as error:
        raise HTTPException(status_code=404, detail="Nothing to report here.") from error
    except SelfReportError as error:
        raise HTTPException(status_code=400, detail="You can't report yourself.") from error
    except ReportLimitReachedError as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "REPORT_LIMIT_REACHED", "message": "You've sent a lot of reports today. Try again tomorrow."},
        ) from error
    return ReportCreated(id=report.id)
