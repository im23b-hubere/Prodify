"""Query, validation, and response mapping for social challenges."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies_subscription import user_has_premium_access
from app.models import SocialChallenge, SocialChallengeMember, User
from app.schemas import SocialChallengeMemberPublic, SocialChallengePublic
from app.services.friend_graph import friend_user_ids
from app.services.social_challenge_service import (
    challenge_completed_recently,
    challenge_duration_days,
    challenge_public_extras,
    load_challenge_meta,
)


class ChallengeNotFoundError(LookupError):
    """Raised when a requested social challenge does not exist."""


class TooManyChallengeParticipantsError(ValueError):
    """Raised when a challenge exceeds the supported participant limit."""


class ChallengeParticipantNotFoundError(LookupError):
    """Raised when at least one requested participant does not exist."""


class ChallengeParticipantNotFriendError(PermissionError):
    """Raised when a requested participant is not an accepted friend."""


def validated_participant_ids(db: Session, owner_id: int, requested_ids: list[int]) -> list[int]:
    participant_ids = sorted({user_id for user_id in requested_ids if user_id != owner_id})
    if len(participant_ids) > 12:
        raise TooManyChallengeParticipantsError
    if participant_ids:
        existing_ids = set(db.scalars(select(User.id).where(User.id.in_(participant_ids))).all())
        if any(user_id not in existing_ids for user_id in participant_ids):
            raise ChallengeParticipantNotFoundError
        accepted_friend_ids = set(friend_user_ids(db, owner_id))
        if any(user_id not in accepted_friend_ids for user_id in participant_ids):
            raise ChallengeParticipantNotFriendError
    return sorted({owner_id, *participant_ids})


def get_challenge(db: Session, challenge_id: int) -> SocialChallenge:
    challenge = db.get(SocialChallenge, challenge_id)
    if challenge is None:
        raise ChallengeNotFoundError
    return challenge


def find_membership(db: Session, challenge_id: int, user_id: int) -> SocialChallengeMember | None:
    return db.scalar(
        select(SocialChallengeMember).where(
            SocialChallengeMember.challenge_id == challenge_id,
            SocialChallengeMember.user_id == user_id,
        )
    )


def challenge_members(db: Session, challenge_id: int) -> list[SocialChallengeMember]:
    return list(
        db.scalars(select(SocialChallengeMember).where(SocialChallengeMember.challenge_id == challenge_id)).all()
    )


def visible_challenges(
    db: Session,
    challenges: list[SocialChallenge],
    current_user_id: int,
) -> list[SocialChallenge]:
    accepted_friend_ids = set(friend_user_ids(db, current_user_id))
    member_challenge_ids = set(
        db.scalars(
            select(SocialChallengeMember.challenge_id).where(SocialChallengeMember.user_id == current_user_id)
        ).all()
    )
    return [
        challenge
        for challenge in challenges
        if challenge.owner_id == current_user_id
        or challenge.owner_id in accepted_friend_ids
        or challenge.id in member_challenge_ids
    ]


def should_list_challenge(challenge: SocialChallenge) -> bool:
    return challenge.status == "active" or (
        challenge.status == "completed" and challenge_completed_recently(load_challenge_meta(challenge))
    )


def challenge_response(
    db: Session,
    challenge_id: int,
    *,
    current_user_id: int | None = None,
) -> SocialChallengePublic:
    challenge = get_challenge(db, challenge_id)
    members = challenge_members(db, challenge_id)
    usernames = {
        user.id: user.username
        for user in db.scalars(select(User).where(User.id.in_([member.user_id for member in members]))).all()
    }
    metadata = load_challenge_meta(challenge)
    owner = db.get(User, challenge.owner_id)
    premium = bool(owner and user_has_premium_access(db, owner))
    return SocialChallengePublic(
        id=challenge.id,
        owner_id=challenge.owner_id,
        challenge_kind=challenge.challenge_kind,
        title=challenge.title,
        week_start=challenge.week_start,
        target_sessions=challenge.target_sessions,
        duration_days=challenge_duration_days(metadata),
        status=challenge.status,
        premium_detail_locked=not premium,
        upsell_hint=None if premium else "Unlock multi-challenge stats and longer durations with Premium.",
        members=[
            SocialChallengeMemberPublic(
                user_id=member.user_id,
                username=usernames.get(member.user_id, "?"),
                progress_sessions=member.progress_sessions,
                team_label=member.team_label,
            )
            for member in sorted(members, key=lambda item: item.progress_sessions, reverse=True)
        ],
        **challenge_public_extras(challenge, members, current_user_id=current_user_id),
    )
