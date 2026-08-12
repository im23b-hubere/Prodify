from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.contracts.social import (
    SocialChallengeCreateBody,
    SocialChallengeJoinBody,
    SocialChallengePublic,
    SocialChallengeUpdateBody,
)
from app.services.social_challenge_application_service import (
    ChallengeDurationPremiumError,
    ChallengeJoinDeniedError,
    ChallengeLimitError,
    ChallengeMembershipNotFoundError,
    ChallengeOwnerCancelRequiredError,
    ChallengeOwnerEditRequiredError,
    ChallengeOwnerLeaveError,
    ChallengeTargetBelowProgressError,
    ChallengeViewDeniedError,
    EmptyChallengeUpdateError,
    InactiveChallengeError,
    SocialChallengeRuleError,
    cancel_owned_challenge as cancel_challenge,
    create_challenge as create_social_challenge,
    join_challenge as join_social_challenge,
    leave_challenge as leave_social_challenge,
    list_challenges as build_challenge_list,
    update_challenge as update_social_challenge,
    view_challenge,
)
from app.services.social_challenge_queries import (
    ChallengeNotFoundError,
    ChallengeParticipantNotFoundError,
    ChallengeParticipantNotFriendError,
    TooManyChallengeParticipantsError,
)


router = APIRouter(prefix="/challenges")


@router.post("", response_model=SocialChallengePublic)
def create_challenge(
    body: SocialChallengeCreateBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return _translate_challenge_errors(create_social_challenge, db, current, body)


@router.post("/join", response_model=SocialChallengePublic)
def join_challenge(
    body: SocialChallengeJoinBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return _translate_challenge_errors(
        join_social_challenge,
        db,
        current,
        body.challenge_id,
    )


@router.get("/{challenge_id}", response_model=SocialChallengePublic)
def get_challenge(
    challenge_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return _translate_challenge_errors(view_challenge, db, current.id, challenge_id)


@router.get("", response_model=list[SocialChallengePublic])
def list_challenges(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return _translate_challenge_errors(build_challenge_list, db, current.id)


@router.patch("/{challenge_id}", response_model=SocialChallengePublic)
def update_challenge(
    challenge_id: int,
    body: SocialChallengeUpdateBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return _translate_challenge_errors(
        update_social_challenge,
        db,
        current,
        challenge_id,
        body,
    )


@router.delete("/{challenge_id}", status_code=204)
def cancel_owned_challenge(
    challenge_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _translate_challenge_errors(cancel_challenge, db, current.id, challenge_id)


@router.post("/{challenge_id}/leave", status_code=204)
def leave_challenge(
    challenge_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _translate_challenge_errors(leave_social_challenge, db, current.id, challenge_id)


def _translate_challenge_errors(operation, *args):
    try:
        return operation(*args)
    except ChallengeNotFoundError as error:
        raise HTTPException(status_code=404, detail="Challenge not found") from error
    except TooManyChallengeParticipantsError as error:
        raise HTTPException(status_code=400, detail="Too many challenge participants requested") from error
    except ChallengeParticipantNotFoundError as error:
        raise HTTPException(status_code=404, detail="One or more challenge members do not exist") from error
    except ChallengeParticipantNotFriendError as error:
        raise HTTPException(status_code=403, detail="Challenge members must be accepted friends") from error
    except SocialChallengeRuleError as error:
        raise _challenge_rule_http_error(error) from error


def _challenge_rule_http_error(error: SocialChallengeRuleError) -> HTTPException:
    if isinstance(error, ChallengeLimitError):
        return HTTPException(status_code=402, detail="Upgrade to create multiple challenges and run parallel accountability loops.")
    if isinstance(error, ChallengeDurationPremiumError):
        return HTTPException(status_code=402, detail="Upgrade to run longer challenges.")
    if isinstance(error, InactiveChallengeError):
        return HTTPException(status_code=400, detail="Challenge is no longer active")
    if isinstance(error, ChallengeJoinDeniedError):
        return HTTPException(status_code=403, detail="You are not allowed to join this challenge")
    if isinstance(error, ChallengeViewDeniedError):
        return HTTPException(status_code=403, detail="You are not allowed to view this challenge")
    if isinstance(error, ChallengeOwnerEditRequiredError):
        return HTTPException(status_code=403, detail="Only the challenge owner can edit it")
    if isinstance(error, EmptyChallengeUpdateError):
        return HTTPException(status_code=400, detail="No challenge fields to update")
    if isinstance(error, ChallengeTargetBelowProgressError):
        return HTTPException(status_code=400, detail="Target cannot be lower than a participant's current progress")
    if isinstance(error, ChallengeOwnerCancelRequiredError):
        return HTTPException(status_code=403, detail="Only the challenge owner can end it")
    if isinstance(error, ChallengeOwnerLeaveError):
        return HTTPException(status_code=400, detail="Challenge owners should end the challenge instead of leaving")
    if isinstance(error, ChallengeMembershipNotFoundError):
        return HTTPException(status_code=404, detail="You are not in this challenge")
    return HTTPException(status_code=400, detail="Challenge operation failed")
