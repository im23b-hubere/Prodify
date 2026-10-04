from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.contracts.social import (
    DuelRecordPublic,
    SessionChallengeCreditPublic,
    SocialChallengeCreateBody,
    SocialChallengeJoinBody,
    SocialChallengePublic,
    SocialChallengeUpdateBody,
)
from app.services.social_challenge_application_service import (
    ChallengeDurationEndsInPastError,
    ChallengeDurationPremiumError,
    ChallengeInviteExpiredError,
    ChallengeInvitePendingError,
    ChallengeInviteRequiredError,
    ChallengeJoinDeniedError,
    ChallengeLimitError,
    ChallengeMembershipNotFoundError,
    ChallengeNotInviteeError,
    ChallengeOwnerCancelRequiredError,
    ChallengeOwnerEditRequiredError,
    ChallengeOwnerLeaveError,
    ChallengeTargetBelowProgressError,
    ChallengeViewDeniedError,
    DuelTermsLockedError,
    EmptyChallengeUpdateError,
    InactiveChallengeError,
    SocialChallengeRuleError,
    accept_challenge as accept_social_challenge,
    cancel_owned_challenge as cancel_challenge,
    create_challenge as create_social_challenge,
    decline_challenge as decline_social_challenge,
    join_challenge as join_social_challenge,
    leave_challenge as leave_social_challenge,
    list_challenges as build_challenge_list,
    settle_challenges_of_user,
    update_challenge as update_social_challenge,
    view_challenge,
)
from app.services.social_challenge_queries import (
    ChallengeNotFoundError,
    ChallengeParticipantNotFoundError,
    ChallengeParticipantNotFriendError,
    TooManyChallengeParticipantsError,
)
from app.services.push_dispatch import schedule_push_to_user
from app.services.push_links import push_data_duel_accepted, push_data_duel_invite
from app.services.social_challenge_notifications import PushChallengeEvents
from app.services.social_challenge_session_credits import (
    SessionCreditsNotFoundError,
    session_challenge_credits,
)
from app.services.social_duel_record_service import duel_records


router = APIRouter(prefix="/challenges")
logger = logging.getLogger(__name__)


@router.post("", response_model=SocialChallengePublic)
def create_challenge(
    body: SocialChallengeCreateBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    challenge = _translate_challenge_errors(create_social_challenge, db, current, body)
    if challenge.status == "pending" and challenge.invitee_user_id:
        _schedule_push(
            challenge.invitee_user_id,
            "Duel invite",
            f"{current.username} challenged you to a duel.",
            push_data_duel_invite(challenge.id),
            label="duel-invite",
        )
    return challenge


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


@router.get("/records", response_model=list[DuelRecordPublic])
def list_duel_records(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    settle_challenges_of_user(db, current.id, _events(db))
    return duel_records(db, current.id)


@router.get("/sessions/{session_id}/credits", response_model=list[SessionChallengeCreditPublic])
def list_session_credits(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return session_challenge_credits(db, current.id, session_id)
    except SessionCreditsNotFoundError as error:
        raise HTTPException(status_code=404, detail="Session not found") from error


@router.get("/{challenge_id}", response_model=SocialChallengePublic)
def get_challenge(
    challenge_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return _translate_challenge_errors(view_challenge, db, current.id, challenge_id, _events(db))


@router.get("", response_model=list[SocialChallengePublic])
def list_challenges(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return _translate_challenge_errors(build_challenge_list, db, current.id, _events(db))


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
        _events(db),
    )


@router.delete("/{challenge_id}", status_code=204)
def cancel_owned_challenge(
    challenge_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _translate_challenge_errors(cancel_challenge, db, current.id, challenge_id, _events(db))


@router.post("/{challenge_id}/accept", response_model=SocialChallengePublic)
def accept_challenge(
    challenge_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    challenge, started = _translate_challenge_errors(
        accept_social_challenge, db, current, challenge_id, _events(db)
    )
    if started:
        _schedule_push(
            challenge.owner_id,
            "Duel accepted",
            f"{current.username} accepted your duel.",
            push_data_duel_accepted(challenge.id),
            label="duel-accepted",
        )
    return challenge


@router.post("/{challenge_id}/decline", status_code=204)
def decline_challenge(
    challenge_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _translate_challenge_errors(decline_social_challenge, db, current, challenge_id, _events(db))


@router.post("/{challenge_id}/leave", status_code=204)
def leave_challenge(
    challenge_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _translate_challenge_errors(leave_social_challenge, db, current.id, challenge_id, _events(db))


def _events(db: Session) -> PushChallengeEvents:
    return PushChallengeEvents(db, settings)


def _schedule_push(user_id: int, title: str, body: str, data: dict[str, str], *, label: str) -> None:
    try:
        schedule_push_to_user(settings, user_id, title, body, data, label=label)
    except Exception:
        logger.exception("schedule %s push failed", label)


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
        return HTTPException(
            status_code=409,
            detail="You already have the maximum number of active challenges.",
        )
    if isinstance(error, ChallengeDurationPremiumError):
        return HTTPException(status_code=402, detail="Upgrade to run longer challenges.")
    if isinstance(error, ChallengeDurationEndsInPastError):
        return HTTPException(status_code=400, detail="The new duration would end the challenge in the past")
    if isinstance(error, DuelTermsLockedError):
        return HTTPException(status_code=409, detail="A running duel's target and duration are locked")
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
    if isinstance(error, ChallengeInviteRequiredError):
        return HTTPException(status_code=400, detail="A duel needs exactly one friend")
    if isinstance(error, ChallengeInvitePendingError):
        return HTTPException(status_code=409, detail="You already have an open invite with this friend")
    if isinstance(error, ChallengeNotInviteeError):
        return HTTPException(status_code=403, detail="Only the invited friend can respond")
    if isinstance(error, ChallengeInviteExpiredError):
        return HTTPException(status_code=400, detail="This invite has expired")
    return HTTPException(status_code=400, detail="Challenge operation failed")
