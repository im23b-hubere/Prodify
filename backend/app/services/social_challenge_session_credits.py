"""Explains, per challenge, whether a finished session counted and why not."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts.social import SessionChallengeCreditPublic, SessionCreditSkipReason
from app.models import ProductionSession, SocialChallenge, SocialChallengeMember
from app.services.social_challenge_service import (
    CHALLENGE_MIN_DURATION_SECONDS,
    challenge_window_end,
    challenge_window_start,
    credited_session_ids,
    load_challenge_meta,
    meta_timestamp,
)
from app.timeutil import as_utc_aware

RELEVANT_STATUSES = ("active", "pending", "completed")


class SessionCreditsNotFoundError(LookupError):
    pass


def session_challenge_credits(db: Session, user_id: int, session_id: int) -> list[SessionChallengeCreditPublic]:
    session = db.get(ProductionSession, session_id)
    if session is None or session.user_id != user_id or session.stopped_at is None:
        raise SessionCreditsNotFoundError
    memberships = {
        member.challenge_id: member
        for member in db.scalars(select(SocialChallengeMember).where(SocialChallengeMember.user_id == user_id)).all()
    }
    if not memberships:
        return []
    challenges = db.scalars(
        select(SocialChallenge)
        .where(SocialChallenge.id.in_(memberships), SocialChallenge.status.in_(RELEVANT_STATUSES))
        .order_by(SocialChallenge.created_at.desc())
    ).all()
    credits = [
        _credit_for(challenge, memberships[challenge.id], session, user_id)
        for challenge in challenges
    ]
    return [credit for credit in credits if credit is not None]


def _credit_for(
    challenge: SocialChallenge,
    member: SocialChallengeMember,
    session: ProductionSession,
    user_id: int,
) -> SessionChallengeCreditPublic | None:
    meta = load_challenge_meta(challenge)
    credited = session.id in credited_session_ids(meta, user_id)
    if not credited and not _overlaps_session(challenge, meta, session):
        return None
    winner = meta.get("winner_user_id")
    return SessionChallengeCreditPublic(
        challenge_id=challenge.id,
        challenge_kind=challenge.challenge_kind,
        title=challenge.title,
        status=challenge.status,
        credited=credited,
        reason=None if credited else _skip_reason(challenge, meta, session),
        progress_sessions=int(member.progress_sessions or 0),
        target_sessions=challenge.target_sessions,
        winner_user_id=int(winner) if isinstance(winner, int) else None,
        is_tie=bool(meta.get("is_tie")),
    )


def _overlaps_session(challenge: SocialChallenge, meta: dict, session: ProductionSession) -> bool:
    """A finished challenge only matters if it ended while or after this session ran."""
    if challenge.status != "completed":
        return True
    completed_at = meta_timestamp(meta, "completed_at")
    return completed_at is not None and completed_at >= as_utc_aware(session.started_at)


def _skip_reason(challenge: SocialChallenge, meta: dict, session: ProductionSession) -> SessionCreditSkipReason | None:
    stopped_at = as_utc_aware(session.stopped_at)
    if session.deleted_at is not None:
        return "session_deleted"
    if challenge.status == "pending":
        return "not_started"
    if int(session.duration_seconds or 0) < CHALLENGE_MIN_DURATION_SECONDS:
        return "too_short"
    if stopped_at < challenge_window_start(challenge):
        return "before_start"
    if _finished_before(meta, stopped_at):
        return "already_finished"
    if stopped_at >= challenge_window_end(challenge, meta):
        return "after_end"
    return None


def _finished_before(meta: dict, stopped_at: datetime) -> bool:
    completed_at = meta_timestamp(meta, "completed_at")
    return completed_at is not None and completed_at <= stopped_at
