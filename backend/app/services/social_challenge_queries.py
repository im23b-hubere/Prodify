"""Query, validation, and response mapping for social challenges."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies_subscription import user_has_premium_access
from app.models import SocialChallenge, SocialChallengeMember, User
from app.contracts.social import SocialChallengeMemberPublic, SocialChallengePublic
from app.services.friend_graph import friend_user_ids
from app.services.social_challenge_service import (
    challenge_cancelled_recently,
    challenge_completed_recently,
    challenge_duration_days,
    challenge_public_extras,
    invitee_user_id,
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


def viewer_can_see_challenge(db: Session, challenge: SocialChallenge, current_user_id: int) -> bool:
    return bool(visible_challenges(db, [challenge], current_user_id))


def visible_challenges(
    db: Session,
    challenges: list[SocialChallenge],
    current_user_id: int,
) -> list[SocialChallenge]:
    if not challenges:
        return []
    accepted_friend_ids = set(friend_user_ids(db, current_user_id))
    member_challenge_ids = participating_challenge_ids(db, current_user_id)
    return [
        challenge
        for challenge in challenges
        if _viewer_can_see_challenge(
            challenge,
            current_user_id=current_user_id,
            accepted_friend_ids=accepted_friend_ids,
            member_challenge_ids=member_challenge_ids,
        )
    ]


def _viewer_can_see_challenge(
    challenge: SocialChallenge,
    *,
    current_user_id: int,
    accepted_friend_ids: set[int],
    member_challenge_ids: set[int],
) -> bool:
    if challenge.owner_id == current_user_id or challenge.id in member_challenge_ids:
        return True
    if challenge.challenge_kind == "duel" or challenge.status == "pending":
        return invitee_user_id(load_challenge_meta(challenge)) == current_user_id
    return challenge.owner_id in accepted_friend_ids


def should_list_challenge(challenge: SocialChallenge, *, viewer_participates: bool) -> bool:
    """Cancellations are news for participants only; an invitee already knows they declined."""
    if challenge.status in {"active", "pending"}:
        return True
    meta = load_challenge_meta(challenge)
    if challenge.status == "completed":
        return challenge_completed_recently(meta)
    return viewer_participates and challenge.status == "cancelled" and challenge_cancelled_recently(meta)


def participating_challenge_ids(db: Session, user_id: int) -> set[int]:
    return set(
        db.scalars(select(SocialChallengeMember.challenge_id).where(SocialChallengeMember.user_id == user_id)).all()
    )


def challenge_response(
    db: Session,
    challenge_id: int,
    *,
    current_user_id: int | None = None,
) -> SocialChallengePublic:
    challenge = get_challenge(db, challenge_id)
    members = challenge_members(db, challenge_id)
    users = (
        db.scalars(select(User).where(User.id.in_([member.user_id for member in members]))).all()
        if members
        else []
    )
    users_by_id = {user.id: user for user in users}
    metadata = load_challenge_meta(challenge)
    owner = db.get(User, challenge.owner_id)
    premium = bool(owner and user_has_premium_access(db, owner))
    extras = challenge_public_extras(challenge, members, current_user_id=current_user_id)
    invitee = db.get(User, extras["invitee_user_id"]) if extras["invitee_user_id"] else None
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
                username=users_by_id[member.user_id].username if member.user_id in users_by_id else "?",
                progress_sessions=member.progress_sessions,
                team_label=member.team_label,
                profile_picture_url=(
                    users_by_id[member.user_id].profile_picture_url
                    if member.user_id in users_by_id
                    else None
                ),
            )
            for member in sorted(members, key=lambda item: item.progress_sessions, reverse=True)
        ],
        invitee_username=invitee.username if invitee else None,
        **extras,
    )
