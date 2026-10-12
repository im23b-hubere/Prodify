from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.contracts.moderation import ContentReportPublic, ReportStatus
from app.database import get_db
from app.dependencies import require_moderator
from app.models import User
from app.services import moderation_service
from app.services.moderation_service import ModerationTargetNotFoundError

router = APIRouter(prefix="/moderation", tags=["moderation"])

Moderator = Annotated[User, Depends(require_moderator)]
Db = Annotated[Session, Depends(get_db)]


@router.get("/reports", response_model=list[ContentReportPublic])
def list_reports(_moderator: Moderator, db: Db, status: ReportStatus = "open"):
    return moderation_service.list_reports(db, status)


@router.post("/reports/{report_id}/resolve", status_code=status.HTTP_204_NO_CONTENT)
def resolve_report(report_id: int, moderator: Moderator, db: Db) -> None:
    _run(moderation_service.resolve_report, db, report_id, moderator.id)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_comment(comment_id: int, _moderator: Moderator, db: Db) -> None:
    _run(moderation_service.remove_comment, db, comment_id)


@router.delete("/users/{user_id}/profile-picture", status_code=status.HTTP_204_NO_CONTENT)
def remove_profile_picture(user_id: int, _moderator: Moderator, db: Db) -> None:
    _run(moderation_service.remove_profile_picture, db, user_id)


@router.post("/users/{user_id}/suspend", status_code=status.HTTP_204_NO_CONTENT)
def suspend_user(user_id: int, _moderator: Moderator, db: Db) -> None:
    _run(moderation_service.suspend_user, db, user_id)


@router.delete("/users/{user_id}/suspend", status_code=status.HTTP_204_NO_CONTENT)
def lift_suspension(user_id: int, _moderator: Moderator, db: Db) -> None:
    _run(moderation_service.lift_suspension, db, user_id)


def _run(operation, *args) -> None:
    try:
        operation(*args)
    except ModerationTargetNotFoundError as error:
        raise HTTPException(status_code=404, detail="Not found") from error
