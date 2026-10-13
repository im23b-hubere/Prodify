"""Users flag other users or comments; moderators are alerted by push."""

import logging
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import ContentReport, User, utcnow
from app.services.push_dispatch import schedule_push_to_user
from app.services.social_feed_service import FeedCommentNotFoundError, visible_session_comment

logger = logging.getLogger(__name__)

DAILY_REPORT_LIMIT = 20


class ReportTargetNotFoundError(ValueError):
    pass


class SelfReportError(ValueError):
    pass


class ReportLimitReachedError(ValueError):
    pass


def report_comment(
    db: Session, settings: Settings, reporter_id: int, comment_id: int, reason: str, note: str | None
) -> ContentReport:
    try:
        comment = visible_session_comment(db, comment_id, reporter_id)
    except FeedCommentNotFoundError as error:
        raise ReportTargetNotFoundError from error
    if comment.author_id == reporter_id:
        raise SelfReportError
    report = ContentReport(
        reported_user_id=comment.author_id,
        target_type="comment",
        comment_id=comment.id,
        content_snapshot=comment.body,
    )
    return _file_report(db, settings, report, reporter_id, reason, note)


def report_user(
    db: Session, settings: Settings, reporter_id: int, reported_user_id: int, reason: str, note: str | None
) -> ContentReport:
    if reported_user_id == reporter_id:
        raise SelfReportError
    reported = db.get(User, reported_user_id)
    if reported is None:
        raise ReportTargetNotFoundError
    report = ContentReport(
        reported_user_id=reported.id,
        target_type="user",
        content_snapshot=f"username: {reported.username}\nprofile picture: {reported.profile_picture_url or '-'}",
    )
    return _file_report(db, settings, report, reporter_id, reason, note)


def _file_report(
    db: Session, settings: Settings, report: ContentReport, reporter_id: int, reason: str, note: str | None
) -> ContentReport:
    if _reports_in_last_day(db, reporter_id) >= DAILY_REPORT_LIMIT:
        raise ReportLimitReachedError
    report.reporter_id = reporter_id
    report.reason = reason
    report.note = (note or "").strip() or None
    report.status = "open"
    db.add(report)
    db.commit()
    db.refresh(report)
    _alert_moderators(settings, report)
    return report


def _reports_in_last_day(db: Session, reporter_id: int) -> int:
    since = utcnow() - timedelta(days=1)
    return db.scalar(
        select(func.count(ContentReport.id)).where(
            ContentReport.reporter_id == reporter_id, ContentReport.created_at >= since
        )
    )


def _alert_moderators(settings: Settings, report: ContentReport) -> None:
    """The push names only the kind of report: reported text must not end up on a lock screen."""
    body = f"A {report.target_type} was reported for {report.reason}."
    data = {"type": "content_report", "report_id": str(report.id)}
    for moderator_id in settings.moderator_user_ids:
        try:
            schedule_push_to_user(settings, moderator_id, "New report", body, data, label="content-report")
        except Exception:
            logger.exception("schedule content-report push failed report_id=%s", report.id)
