from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies_subscription import user_has_premium_access
from app.models import SocialCommitment, User, utcnow
from app.schemas import CommitmentBody, CommitmentPublic
from app.services.commitment_witness_service import (
    notify_witnesses,
    save_witness_config,
    witness_user_ids,
    witness_usernames,
)
from app.services.friend_graph import friend_user_ids
from app.services.kpi_tracker import track_event
from app.services.progression_service import grant_xp
from app.services.social_week_service import current_week_start, session_count


class TooManyWitnessesError(ValueError):
    pass


class WitnessNotFriendError(ValueError):
    pass


def publish_commitment(db: Session, user: User, request: CommitmentBody) -> CommitmentPublic:
    week_start = current_week_start()
    witness_ids = _validated_witness_ids(db, user.id, request.witness_user_ids)
    commitment = _find_commitment(db, user.id, week_start, request.commitment_key)
    if commitment is None:
        commitment = _new_commitment(db, user.id, week_start, request.commitment_key)
    _update_commitment(commitment, request)
    save_witness_config(
        db,
        user_id=user.id,
        week_start=week_start,
        commitment_key=commitment.commitment_key,
        witness_user_ids=witness_ids,
    )
    _track_published(db, user.id, commitment, witness_ids)
    db.commit()
    notify_witnesses(
        db,
        actor=user,
        week_start=week_start,
        commitment_key=commitment.commitment_key,
        target_sessions=commitment.target_sessions,
        current_sessions=0,
        status="on_track",
        notify_kind="started",
        marker=f"target:{commitment.target_sessions}",
    )
    return _to_public(db, user, commitment)


def get_current_commitment(
    db: Session,
    user: User,
    commitment_key: str,
) -> CommitmentPublic | None:
    commitment = _find_commitment(db, user.id, current_week_start(), commitment_key)
    return _to_public(db, user, commitment) if commitment else None


def list_current_commitments(db: Session, user: User) -> list[CommitmentPublic]:
    commitments = db.scalars(
        select(SocialCommitment).where(
            SocialCommitment.user_id == user.id,
            SocialCommitment.week_start == current_week_start(),
        )
    ).all()
    return [_to_public(db, user, commitment) for commitment in commitments]


def _new_commitment(
    db: Session,
    user_id: int,
    week_start: str,
    commitment_key: str,
) -> SocialCommitment:
    commitment = SocialCommitment(user_id=user_id, week_start=week_start)
    db.add(commitment)
    grant_xp(
        db,
        user_id,
        5,
        source_type="social_commitment_set",
        source_id=f"{week_start}:{commitment_key}",
        meta={"week_start": week_start, "commitment_key": commitment_key},
    )
    return commitment


def _update_commitment(commitment: SocialCommitment, request: CommitmentBody) -> None:
    commitment.target_sessions = request.target_sessions
    commitment.visibility = request.visibility
    commitment.commitment_key = request.commitment_key
    commitment.period_days = request.period_days


def _track_published(
    db: Session,
    user_id: int,
    commitment: SocialCommitment,
    witness_ids: list[int],
) -> None:
    track_event(
        db,
        "commitment_published",
        user_id=user_id,
        props={
            "week_start": commitment.week_start,
            "commitment_key": commitment.commitment_key,
            "target_sessions": commitment.target_sessions,
            "witness_count": len(witness_ids),
            "witness_user_ids": witness_ids,
        },
    )


def _validated_witness_ids(db: Session, user_id: int, requested_ids: list[int]) -> list[int]:
    selected_ids = sorted(
        {int(candidate) for candidate in requested_ids if int(candidate) > 0 and int(candidate) != user_id}
    )
    if len(selected_ids) > 3:
        raise TooManyWitnessesError("Pick up to 3 witnesses")
    accepted_friend_ids = set(friend_user_ids(db, user_id))
    if any(witness_id not in accepted_friend_ids for witness_id in selected_ids):
        raise WitnessNotFriendError("Witnesses must be accepted friends")
    return selected_ids


def _find_commitment(
    db: Session,
    user_id: int,
    week_start: str,
    commitment_key: str,
) -> SocialCommitment | None:
    return db.scalar(
        select(SocialCommitment).where(
            SocialCommitment.user_id == user_id,
            SocialCommitment.week_start == week_start,
            SocialCommitment.commitment_key == commitment_key,
        )
    )


def _to_public(db: Session, user: User, commitment: SocialCommitment) -> CommitmentPublic:
    completed_sessions = session_count(db, user.id, commitment.week_start)
    selected_witness_ids = witness_user_ids(
        db,
        user.id,
        commitment.week_start,
        commitment.commitment_key,
        limit=3,
    )
    return CommitmentPublic(
        week_start=commitment.week_start,
        commitment_key=commitment.commitment_key,
        period_days=int(commitment.period_days or 7),
        target_sessions=commitment.target_sessions,
        current_sessions=completed_sessions,
        status=_progress_status(completed_sessions, commitment.target_sessions),
        visibility=commitment.visibility,
        upsell_hint=None if user_has_premium_access(db, user) else "Track more goals with Premium.",
        witness_user_ids=selected_witness_ids,
        witness_usernames=witness_usernames(db, selected_witness_ids),
    )


def _progress_status(current_sessions: int, target_sessions: int) -> str:
    if current_sessions >= target_sessions:
        return "completed"
    expected = max(1, (utcnow().date().weekday() + 1) * target_sessions // 7)
    return "on_track" if current_sessions + 1 >= expected else "behind"
