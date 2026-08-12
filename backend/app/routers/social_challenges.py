from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.dependencies_subscription import user_has_premium_access
from app.models import SocialChallenge, SocialChallengeMember, User
from app.schemas import (
    SocialChallengeCreateBody,
    SocialChallengeJoinBody,
    SocialChallengeMemberPublic,
    SocialChallengePublic,
    SocialChallengeUpdateBody,
)
from app.services.friend_graph import friend_user_ids
from app.services.progression_service import grant_xp
from app.services.social_challenge_service import (
    cancel_challenge,
    challenge_completed_recently,
    challenge_duration_days,
    challenge_public_extras,
    finalize_visible_active_challenges,
    load_challenge_meta,
    save_challenge_meta,
)
from app.services.social_week_service import current_week_start
from app.services.social_challenge_queries import (
    ChallengeNotFoundError,
    ChallengeParticipantNotFoundError,
    ChallengeParticipantNotFriendError,
    TooManyChallengeParticipantsError,
    challenge_members,
    challenge_response,
    find_membership,
    get_challenge as load_challenge,
    should_list_challenge,
    validated_participant_ids,
    visible_challenges,
)


router = APIRouter(prefix="/challenges")


def get_challenge_or_404(db: Session, challenge_id: int) -> SocialChallenge:
    try:
        return load_challenge(db, challenge_id)
    except ChallengeNotFoundError as error:
        raise HTTPException(status_code=404, detail="Challenge not found") from error


def validate_participant_ids(db: Session, owner_id: int, requested_ids: list[int]) -> list[int]:
    try:
        return validated_participant_ids(db, owner_id, requested_ids)
    except TooManyChallengeParticipantsError as error:
        raise HTTPException(status_code=400, detail="Too many challenge participants requested") from error
    except ChallengeParticipantNotFoundError as error:
        raise HTTPException(status_code=404, detail="One or more challenge members do not exist") from error
    except ChallengeParticipantNotFriendError as error:
        raise HTTPException(status_code=403, detail="Challenge members must be accepted friends") from error


def build_challenge_response(
    db: Session,
    challenge_id: int,
    *,
    current_user_id: int,
) -> SocialChallengePublic:
    try:
        return challenge_response(db, challenge_id, current_user_id=current_user_id)
    except ChallengeNotFoundError as error:
        raise HTTPException(status_code=404, detail="Challenge not found") from error


@router.post("", response_model=SocialChallengePublic)
def create_challenge(
    body: SocialChallengeCreateBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    premium = user_has_premium_access(db, current)
    active_owned = db.scalars(
        select(SocialChallenge).where(
            SocialChallenge.owner_id == current.id,
            SocialChallenge.status == "active",
        )
    ).all()
    maximum_challenges = (3 if premium else 1) + int(current.bonus_challenge_slots or 0)
    if len(active_owned) >= maximum_challenges:
        raise HTTPException(
            status_code=402,
            detail="Upgrade to create multiple challenges and run parallel accountability loops.",
        )
    if not premium and body.duration_days > 7:
        raise HTTPException(status_code=402, detail="Upgrade to run longer challenges.")

    participant_ids = validate_participant_ids(db, current.id, body.member_user_ids)
    challenge = SocialChallenge(
        owner_id=current.id,
        challenge_kind=body.challenge_kind,
        title=body.title.strip(),
        week_start=current_week_start(),
        target_sessions=body.target_sessions,
        status="active",
        meta_json=json.dumps({"duration_days": body.duration_days, "credited_sessions": {}}),
    )
    db.add(challenge)
    db.flush()
    for user_id in participant_ids:
        db.add(SocialChallengeMember(challenge_id=challenge.id, user_id=user_id, progress_sessions=0))
    db.commit()
    return build_challenge_response(db, challenge.id, current_user_id=current.id)


@router.post("/join", response_model=SocialChallengePublic)
def join_challenge(
    body: SocialChallengeJoinBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    challenge = get_challenge_or_404(db, body.challenge_id)
    membership = find_membership(db, challenge.id, current.id)
    if membership is None:
        if challenge.status != "active":
            raise HTTPException(status_code=400, detail="Challenge is no longer active")
        if challenge.owner_id != current.id and challenge.owner_id not in set(friend_user_ids(db, current.id)):
            raise HTTPException(status_code=403, detail="You are not allowed to join this challenge")
        db.add(SocialChallengeMember(challenge_id=challenge.id, user_id=current.id, progress_sessions=0))
        grant_xp(
            db,
            current.id,
            8,
            source_type="social_challenge_join",
            source_id=str(challenge.id),
            meta={"challenge_id": challenge.id},
        )
        db.commit()
    return build_challenge_response(db, challenge.id, current_user_id=current.id)


@router.get("/{challenge_id}", response_model=SocialChallengePublic)
def get_challenge(
    challenge_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    challenge = get_challenge_or_404(db, challenge_id)
    owner_is_friend = challenge.owner_id in set(friend_user_ids(db, current.id))
    is_member = find_membership(db, challenge_id, current.id) is not None
    if challenge.owner_id != current.id and not owner_is_friend and not is_member:
        raise HTTPException(status_code=403, detail="You are not allowed to view this challenge")
    if challenge.status == "active":
        finalize_visible_active_challenges(db, [challenge])
        db.commit()
    return build_challenge_response(db, challenge.id, current_user_id=current.id)


@router.get("", response_model=list[SocialChallengePublic])
def list_challenges(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    challenges = db.scalars(select(SocialChallenge).order_by(SocialChallenge.created_at.desc()).limit(40)).all()
    visible = visible_challenges(db, challenges, current.id)
    finalize_visible_active_challenges(db, [challenge for challenge in visible if challenge.status == "active"])
    db.commit()
    current_challenges = [challenge for challenge in visible if should_list_challenge(challenge)][:20]
    return [build_challenge_response(db, challenge.id, current_user_id=current.id) for challenge in current_challenges]


@router.patch("/{challenge_id}", response_model=SocialChallengePublic)
def update_challenge(
    challenge_id: int,
    body: SocialChallengeUpdateBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    challenge = get_challenge_or_404(db, challenge_id)
    if challenge.owner_id != current.id:
        raise HTTPException(status_code=403, detail="Only the challenge owner can edit it")
    if challenge.status != "active":
        raise HTTPException(status_code=400, detail="Only active challenges can be edited")
    if body.title is None and body.target_sessions is None and body.duration_days is None:
        raise HTTPException(status_code=400, detail="No challenge fields to update")

    members = challenge_members(db, challenge_id)
    metadata = load_challenge_meta(challenge)
    if body.title is not None:
        challenge.title = body.title.strip()
    if body.target_sessions is not None:
        maximum_progress = max((int(member.progress_sessions or 0) for member in members), default=0)
        if body.target_sessions < maximum_progress:
            raise HTTPException(
                status_code=400,
                detail="Target cannot be lower than a participant's current progress",
            )
        challenge.target_sessions = body.target_sessions
    if body.duration_days is not None:
        if not user_has_premium_access(db, current) and body.duration_days > 7:
            raise HTTPException(status_code=402, detail="Upgrade to run longer challenges.")
        metadata["duration_days"] = body.duration_days
        save_challenge_meta(challenge, metadata)

    db.commit()
    return build_challenge_response(db, challenge.id, current_user_id=current.id)


@router.delete("/{challenge_id}", status_code=204)
def cancel_owned_challenge(
    challenge_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    challenge = get_challenge_or_404(db, challenge_id)
    if challenge.owner_id != current.id:
        raise HTTPException(status_code=403, detail="Only the challenge owner can end it")
    if challenge.status != "active":
        raise HTTPException(status_code=400, detail="Challenge is no longer active")
    cancel_challenge(db, challenge, reason="cancelled")
    db.commit()


@router.post("/{challenge_id}/leave", status_code=204)
def leave_challenge(
    challenge_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    challenge = get_challenge_or_404(db, challenge_id)
    if challenge.owner_id == current.id:
        raise HTTPException(status_code=400, detail="Challenge owners should end the challenge instead of leaving")
    if challenge.status != "active":
        raise HTTPException(status_code=400, detail="Challenge is no longer active")
    membership = find_membership(db, challenge_id, current.id)
    if membership is None:
        raise HTTPException(status_code=404, detail="You are not in this challenge")
    db.delete(membership)
    db.flush()
    if len(challenge_members(db, challenge_id)) < 2:
        cancel_challenge(db, challenge, reason="member_left")
    db.commit()
