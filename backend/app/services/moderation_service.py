"""Actions only moderators may take: working the report queue, removing content, suspending accounts."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts.moderation import ContentReportPublic, ReportStatus
from app.models import ContentReport, SocialComment, User, utcnow
from app.services.auth_token_service import revoke_user_tokens
from app.services.profile_picture_service import delete_profile_picture

_REPORT_PAGE_SIZE = 100


class ModerationTargetNotFoundError(ValueError):
    pass


def list_reports(db: Session, status: ReportStatus) -> list[ContentReportPublic]:
    reports = db.scalars(
        select(ContentReport)
        .where(ContentReport.status == status)
        .order_by(ContentReport.created_at.desc())
        .limit(_REPORT_PAGE_SIZE)
    ).all()
    user_ids = {report.reported_user_id for report in reports} | {
        report.reporter_id for report in reports if report.reporter_id is not None
    }
    users = {user.id: user for user in db.scalars(select(User).where(User.id.in_(user_ids))).all()}
    return [_report_response(report, users) for report in reports]


def resolve_report(db: Session, report_id: int, moderator_id: int) -> None:
    report = _require(db, ContentReport, report_id)
    report.status = "resolved"
    report.resolved_at = utcnow()
    report.resolved_by_id = moderator_id
    db.commit()


def remove_comment(db: Session, comment_id: int) -> None:
    db.delete(_require(db, SocialComment, comment_id))
    db.commit()


def remove_profile_picture(db: Session, user_id: int) -> None:
    user = _require(db, User, user_id)
    delete_profile_picture(user.profile_picture_url)
    user.profile_picture_url = None
    db.commit()


def suspend_user(db: Session, user_id: int) -> None:
    """Signs the user out everywhere; sign-in stays refused until the suspension is lifted."""
    user = _require(db, User, user_id)
    if user.suspended_at is None:
        user.suspended_at = utcnow()
    revoke_user_tokens(db, user)


def lift_suspension(db: Session, user_id: int) -> None:
    user = _require(db, User, user_id)
    user.suspended_at = None
    db.commit()


def _require(db: Session, model, record_id: int):
    record = db.get(model, record_id)
    if record is None:
        raise ModerationTargetNotFoundError
    return record


def _report_response(report: ContentReport, users: dict[int, User]) -> ContentReportPublic:
    reporter = users.get(report.reporter_id) if report.reporter_id is not None else None
    reported = users.get(report.reported_user_id)
    return ContentReportPublic(
        id=report.id,
        target_type=report.target_type,
        comment_id=report.comment_id,
        content_snapshot=report.content_snapshot,
        reason=report.reason,
        note=report.note,
        status=report.status,
        created_at=report.created_at,
        resolved_at=report.resolved_at,
        reporter_id=report.reporter_id,
        reporter_username=reporter.username if reporter else None,
        reported_user_id=report.reported_user_id,
        reported_username=reported.username if reported else "?",
        reported_user_is_suspended=bool(reported and reported.suspended_at is not None),
    )
