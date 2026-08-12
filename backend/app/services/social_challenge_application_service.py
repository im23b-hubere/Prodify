import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts.social import (
    SocialChallengeCreateBody,
    SocialChallengePublic,
    SocialChallengeUpdateBody,
)
from app.dependencies_subscription import user_has_premium_access
from app.models import SocialChallenge, SocialChallengeMember, User
from app.services.friend_graph import friend_user_ids
from app.services.progression_service import grant_xp
from app.services.social_challenge_queries import (
    challenge_members,
    challenge_response,
    find_membership,
    get_challenge,
    should_list_challenge,
    validated_participant_ids,
    visible_challenges,
)
from app.services.social_challenge_service import (
    cancel_challenge,
    finalize_visible_active_challenges,
    load_challenge_meta,
    save_challenge_meta,
)
from app.services.social_week_service import current_week_start


class SocialChallengeRuleError(ValueError):
    pass


class ChallengeLimitError(SocialChallengeRuleError):
    pass


class ChallengeDurationPremiumError(SocialChallengeRuleError):
    pass


class InactiveChallengeError(SocialChallengeRuleError):
    pass


class ChallengeJoinDeniedError(SocialChallengeRuleError):
    pass


class ChallengeViewDeniedError(SocialChallengeRuleError):
    pass


class ChallengeOwnerEditRequiredError(SocialChallengeRuleError):
    pass


class EmptyChallengeUpdateError(SocialChallengeRuleError):
    pass


class ChallengeTargetBelowProgressError(SocialChallengeRuleError):
    pass


class ChallengeOwnerCancelRequiredError(SocialChallengeRuleError):
    pass


class ChallengeOwnerLeaveError(SocialChallengeRuleError):
    pass


class ChallengeMembershipNotFoundError(SocialChallengeRuleError):
    pass


def create_challenge(
    db: Session,
    owner: User,
    request: SocialChallengeCreateBody,
) -> SocialChallengePublic:
    premium = user_has_premium_access(db, owner)
    active_count = len(
        db.scalars(
            select(SocialChallenge).where(
                SocialChallenge.owner_id == owner.id,
                SocialChallenge.status == "active",
            )
        ).all()
    )
    maximum = (3 if premium else 1) + int(owner.bonus_challenge_slots or 0)
    if active_count >= maximum:
        raise ChallengeLimitError
    if not premium and request.duration_days > 7:
        raise ChallengeDurationPremiumError
    participant_ids = validated_participant_ids(db, owner.id, request.member_user_ids)
    challenge = SocialChallenge(
        owner_id=owner.id,
        challenge_kind=request.challenge_kind,
        title=request.title.strip(),
        week_start=current_week_start(),
        target_sessions=request.target_sessions,
        status="active",
        meta_json=json.dumps(
            {"duration_days": request.duration_days, "credited_sessions": {}}
        ),
    )
    db.add(challenge)
    db.flush()
    for user_id in participant_ids:
        db.add(
            SocialChallengeMember(
                challenge_id=challenge.id,
                user_id=user_id,
                progress_sessions=0,
            )
        )
    db.commit()
    return challenge_response(db, challenge.id, current_user_id=owner.id)


def join_challenge(db: Session, user: User, challenge_id: int) -> SocialChallengePublic:
    challenge = get_challenge(db, challenge_id)
    membership = find_membership(db, challenge.id, user.id)
    if membership is None:
        if challenge.status != "active":
            raise InactiveChallengeError
        owner_is_friend = challenge.owner_id in set(friend_user_ids(db, user.id))
        if challenge.owner_id != user.id and not owner_is_friend:
            raise ChallengeJoinDeniedError
        db.add(
            SocialChallengeMember(
                challenge_id=challenge.id,
                user_id=user.id,
                progress_sessions=0,
            )
        )
        grant_xp(
            db,
            user.id,
            8,
            source_type="social_challenge_join",
            source_id=str(challenge.id),
            meta={"challenge_id": challenge.id},
        )
        db.commit()
    return challenge_response(db, challenge.id, current_user_id=user.id)


def view_challenge(db: Session, user_id: int, challenge_id: int) -> SocialChallengePublic:
    challenge = get_challenge(db, challenge_id)
    owner_is_friend = challenge.owner_id in set(friend_user_ids(db, user_id))
    is_member = find_membership(db, challenge_id, user_id) is not None
    if challenge.owner_id != user_id and not owner_is_friend and not is_member:
        raise ChallengeViewDeniedError
    if challenge.status == "active":
        finalize_visible_active_challenges(db, [challenge])
        db.commit()
    return challenge_response(db, challenge.id, current_user_id=user_id)


def list_challenges(db: Session, user_id: int) -> list[SocialChallengePublic]:
    challenges = db.scalars(
        select(SocialChallenge).order_by(SocialChallenge.created_at.desc()).limit(40)
    ).all()
    visible = visible_challenges(db, challenges, user_id)
    finalize_visible_active_challenges(
        db,
        [challenge for challenge in visible if challenge.status == "active"],
    )
    db.commit()
    current = [challenge for challenge in visible if should_list_challenge(challenge)][:20]
    return [
        challenge_response(db, challenge.id, current_user_id=user_id)
        for challenge in current
    ]


def update_challenge(
    db: Session,
    owner: User,
    challenge_id: int,
    request: SocialChallengeUpdateBody,
) -> SocialChallengePublic:
    challenge = get_challenge(db, challenge_id)
    if challenge.owner_id != owner.id:
        raise ChallengeOwnerEditRequiredError
    if challenge.status != "active":
        raise InactiveChallengeError
    if request.title is None and request.target_sessions is None and request.duration_days is None:
        raise EmptyChallengeUpdateError
    metadata = load_challenge_meta(challenge)
    if request.title is not None:
        challenge.title = request.title.strip()
    if request.target_sessions is not None:
        maximum_progress = max(
            (int(member.progress_sessions or 0) for member in challenge_members(db, challenge_id)),
            default=0,
        )
        if request.target_sessions < maximum_progress:
            raise ChallengeTargetBelowProgressError
        challenge.target_sessions = request.target_sessions
    if request.duration_days is not None:
        if not user_has_premium_access(db, owner) and request.duration_days > 7:
            raise ChallengeDurationPremiumError
        metadata["duration_days"] = request.duration_days
        save_challenge_meta(challenge, metadata)
    db.commit()
    return challenge_response(db, challenge.id, current_user_id=owner.id)


def cancel_owned_challenge(db: Session, user_id: int, challenge_id: int) -> None:
    challenge = get_challenge(db, challenge_id)
    if challenge.owner_id != user_id:
        raise ChallengeOwnerCancelRequiredError
    if challenge.status != "active":
        raise InactiveChallengeError
    cancel_challenge(db, challenge, reason="cancelled")
    db.commit()


def leave_challenge(db: Session, user_id: int, challenge_id: int) -> None:
    challenge = get_challenge(db, challenge_id)
    if challenge.owner_id == user_id:
        raise ChallengeOwnerLeaveError
    if challenge.status != "active":
        raise InactiveChallengeError
    membership = find_membership(db, challenge_id, user_id)
    if membership is None:
        raise ChallengeMembershipNotFoundError
    db.delete(membership)
    db.flush()
    if len(challenge_members(db, challenge_id)) < 2:
        cancel_challenge(db, challenge, reason="member_left")
    db.commit()
