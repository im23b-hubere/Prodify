import json
from dataclasses import dataclass, field
from datetime import timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.contracts.social import (
    SocialChallengeCreateBody,
    SocialChallengePublic,
    SocialChallengeUpdateBody,
)
from app.dependencies_subscription import user_has_premium_access
from app.models import SocialChallenge, SocialChallengeMember, User, utcnow
from app.services.friend_graph import friend_user_ids
from app.services.progression_service import grant_xp
from app.services.social_challenge_events import IGNORED_CHALLENGE_EVENTS, ChallengeEvents
from app.services.social_challenge_queries import (
    challenge_members,
    challenge_response,
    find_membership,
    get_challenge,
    participating_challenge_ids,
    should_list_challenge,
    validated_participant_ids,
    viewer_can_see_challenge,
    visible_challenges,
)
from app.services.social_challenge_service import (
    cancel_challenge,
    challenge_window_start,
    finalize_visible_active_challenges,
    finish_if_target_reached,
    invite_is_expired,
    load_challenge_meta,
    save_challenge_meta,
)
from app.services.social_week_service import current_week_start
from app.timeutil import as_utc_aware

OPEN_STATUSES = ("active", "pending")
LISTED_CHALLENGES_LIMIT = 30
FINISHED_CANDIDATES_LIMIT = 40
FRIEND_CANDIDATES_LIMIT = 40


class SocialChallengeRuleError(ValueError):
    pass


class ChallengeLimitError(SocialChallengeRuleError):
    pass


class ChallengeDurationPremiumError(SocialChallengeRuleError):
    pass


class ChallengeDurationEndsInPastError(SocialChallengeRuleError):
    pass


class DuelTermsLockedError(SocialChallengeRuleError):
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


class ChallengeInviteRequiredError(SocialChallengeRuleError):
    pass


class ChallengeInvitePendingError(SocialChallengeRuleError):
    pass


class ChallengeNotInviteeError(SocialChallengeRuleError):
    pass


class ChallengeInviteExpiredError(SocialChallengeRuleError):
    pass


@dataclass
class SettledChallenges:
    """Challenges that ran out of time while nobody was looking."""

    finished_ids: list[int] = field(default_factory=list)
    expired_invite_ids: list[int] = field(default_factory=list)

    def announce(self, events: ChallengeEvents) -> None:
        for challenge_id in self.finished_ids:
            events.challenge_finished(challenge_id)
        for challenge_id in self.expired_invite_ids:
            events.challenge_cancelled(challenge_id)


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
    invitees = [user_id for user_id in participant_ids if user_id != owner.id]
    if request.challenge_kind == "duel":
        return _create_duel_invite(db, owner, request, invitees)
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
        if challenge.challenge_kind == "duel":
            raise ChallengeJoinDeniedError
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


def view_challenge(
    db: Session,
    user_id: int,
    challenge_id: int,
    events: ChallengeEvents = IGNORED_CHALLENGE_EVENTS,
) -> SocialChallengePublic:
    challenge = get_challenge(db, challenge_id)
    if not viewer_can_see_challenge(db, challenge, user_id):
        raise ChallengeViewDeniedError
    settled = settle_due_challenges(db, [challenge])
    db.commit()
    settled.announce(events)
    return challenge_response(db, challenge.id, current_user_id=user_id)


def list_challenges(
    db: Session,
    user_id: int,
    events: ChallengeEvents = IGNORED_CHALLENGE_EVENTS,
) -> list[SocialChallengePublic]:
    visible = visible_challenges(db, _listing_candidates(db, user_id), user_id)
    settled = settle_due_challenges(db, visible)
    db.commit()
    settled.announce(events)
    member_challenge_ids = participating_challenge_ids(db, user_id)
    listed = sorted(
        (
            challenge
            for challenge in visible
            if should_list_challenge(
                challenge,
                viewer_participates=challenge.owner_id == user_id or challenge.id in member_challenge_ids,
            )
        ),
        key=lambda challenge: (challenge.status not in OPEN_STATUSES, -challenge.created_at.timestamp()),
    )
    return [
        challenge_response(db, challenge.id, current_user_id=user_id)
        for challenge in listed[:LISTED_CHALLENGES_LIMIT]
    ]


def settle_challenges_of_user(
    db: Session,
    user_id: int,
    events: ChallengeEvents = IGNORED_CHALLENGE_EVENTS,
) -> None:
    open_challenges = db.scalars(
        select(SocialChallenge).where(_involves(user_id), SocialChallenge.status.in_(OPEN_STATUSES))
    ).all()
    settled = settle_due_challenges(db, list(open_challenges))
    db.commit()
    settled.announce(events)


def settle_due_challenges(db: Session, challenges: list[SocialChallenge]) -> SettledChallenges:
    """Finishes challenges whose window ended and expires stale invites (caller commits)."""
    return SettledChallenges(
        expired_invite_ids=[
            challenge.id for challenge in challenges if _expire_invite_if_needed(db, challenge)
        ],
        finished_ids=finalize_visible_active_challenges(
            db, [challenge for challenge in challenges if challenge.status == "active"]
        ),
    )


def _listing_candidates(db: Session, user_id: int) -> list[SocialChallenge]:
    """Own open challenges never compete with old ones for a slot in the result."""
    mine = _involves(user_id)
    is_open = SocialChallenge.status.in_(OPEN_STATUSES)
    newest_first = SocialChallenge.created_at.desc()
    candidates = {
        challenge.id: challenge
        for challenge in [
            *db.scalars(select(SocialChallenge).where(mine, is_open)).all(),
            *db.scalars(
                select(SocialChallenge).where(mine, ~is_open).order_by(newest_first).limit(FINISHED_CANDIDATES_LIMIT)
            ).all(),
        ]
    }
    friend_ids = friend_user_ids(db, user_id)
    if friend_ids:
        for challenge in db.scalars(
            select(SocialChallenge)
            .where(SocialChallenge.owner_id.in_(friend_ids), is_open)
            .order_by(newest_first)
            .limit(FRIEND_CANDIDATES_LIMIT)
        ).all():
            candidates.setdefault(challenge.id, challenge)
    return list(candidates.values())


def _involves(user_id: int):
    member_challenge_ids = select(SocialChallengeMember.challenge_id).where(SocialChallengeMember.user_id == user_id)
    return or_(SocialChallenge.owner_id == user_id, SocialChallenge.id.in_(member_challenge_ids))


def update_challenge(
    db: Session,
    owner: User,
    challenge_id: int,
    request: SocialChallengeUpdateBody,
    events: ChallengeEvents = IGNORED_CHALLENGE_EVENTS,
) -> SocialChallengePublic:
    challenge = get_challenge(db, challenge_id)
    if challenge.owner_id != owner.id:
        raise ChallengeOwnerEditRequiredError
    if challenge.status != "active":
        raise InactiveChallengeError
    if request.title is None and request.target_sessions is None and request.duration_days is None:
        raise EmptyChallengeUpdateError
    changes_terms = request.target_sessions is not None or request.duration_days is not None
    if challenge.challenge_kind == "duel" and changes_terms:
        raise DuelTermsLockedError
    if request.title is not None:
        challenge.title = request.title.strip()
    if request.target_sessions is not None:
        _apply_target(db, challenge, request.target_sessions)
    if request.duration_days is not None:
        _apply_duration(db, owner, challenge, request.duration_days)
    finished = finish_if_target_reached(db, challenge)
    db.commit()
    if finished:
        events.challenge_finished(challenge.id)
    return challenge_response(db, challenge.id, current_user_id=owner.id)


def _apply_target(db: Session, challenge: SocialChallenge, target_sessions: int) -> None:
    maximum_progress = max(
        (int(member.progress_sessions or 0) for member in challenge_members(db, challenge.id)),
        default=0,
    )
    if target_sessions < maximum_progress:
        raise ChallengeTargetBelowProgressError
    challenge.target_sessions = target_sessions


def _apply_duration(db: Session, owner: User, challenge: SocialChallenge, duration_days: int) -> None:
    if not user_has_premium_access(db, owner) and duration_days > 7:
        raise ChallengeDurationPremiumError
    if challenge_window_start(challenge) + timedelta(days=duration_days) <= as_utc_aware(utcnow()):
        raise ChallengeDurationEndsInPastError
    metadata = load_challenge_meta(challenge)
    metadata["duration_days"] = duration_days
    save_challenge_meta(challenge, metadata)


def cancel_owned_challenge(
    db: Session,
    user_id: int,
    challenge_id: int,
    events: ChallengeEvents = IGNORED_CHALLENGE_EVENTS,
) -> None:
    challenge = get_challenge(db, challenge_id)
    if challenge.owner_id != user_id:
        raise ChallengeOwnerCancelRequiredError
    if challenge.status not in OPEN_STATUSES:
        raise InactiveChallengeError
    reason = "withdrawn" if challenge.status == "pending" else "cancelled"
    cancel_challenge(db, challenge, reason=reason, actor_user_id=user_id)
    db.commit()
    events.challenge_cancelled(challenge.id)


def leave_challenge(
    db: Session,
    user_id: int,
    challenge_id: int,
    events: ChallengeEvents = IGNORED_CHALLENGE_EVENTS,
) -> None:
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
    ended = len(challenge_members(db, challenge_id)) < 2
    if ended:
        cancel_challenge(db, challenge, reason="member_left", actor_user_id=user_id)
    db.commit()
    if ended:
        events.challenge_cancelled(challenge.id)


def accept_challenge(
    db: Session,
    user: User,
    challenge_id: int,
    events: ChallengeEvents = IGNORED_CHALLENGE_EVENTS,
) -> tuple[SocialChallengePublic, bool]:
    """Returns the challenge and whether this call started it."""
    challenge = get_challenge(db, challenge_id)
    if challenge.status == "active" and find_membership(db, challenge.id, user.id) is not None:
        return challenge_response(db, challenge.id, current_user_id=user.id), False
    if challenge.status != "pending":
        raise InactiveChallengeError
    meta = load_challenge_meta(challenge)
    _require_invitee(meta, user)
    if challenge.owner_id not in set(friend_user_ids(db, user.id)):
        raise ChallengeJoinDeniedError
    if invite_is_expired(meta):
        cancel_challenge(db, challenge, reason="invite_expired")
        db.commit()
        events.challenge_cancelled(challenge.id)
        raise ChallengeInviteExpiredError
    meta["started_at"] = utcnow().isoformat()
    save_challenge_meta(challenge, meta)
    challenge.status = "active"
    if find_membership(db, challenge.id, user.id) is None:
        db.add(
            SocialChallengeMember(
                challenge_id=challenge.id,
                user_id=user.id,
                progress_sessions=0,
            )
        )
    db.commit()
    return challenge_response(db, challenge.id, current_user_id=user.id), True


def decline_challenge(
    db: Session,
    user: User,
    challenge_id: int,
    events: ChallengeEvents = IGNORED_CHALLENGE_EVENTS,
) -> None:
    challenge = get_challenge(db, challenge_id)
    if challenge.status != "pending":
        raise InactiveChallengeError
    _require_invitee(load_challenge_meta(challenge), user)
    cancel_challenge(db, challenge, reason="declined", actor_user_id=user.id)
    db.commit()
    events.challenge_cancelled(challenge.id)


def _create_duel_invite(
    db: Session,
    owner: User,
    request: SocialChallengeCreateBody,
    invitees: list[int],
) -> SocialChallengePublic:
    if len(invitees) != 1:
        raise ChallengeInviteRequiredError
    invitee_id = invitees[0]
    if _open_invite_between(db, owner.id, invitee_id) is not None:
        raise ChallengeInvitePendingError
    challenge = SocialChallenge(
        owner_id=owner.id,
        challenge_kind="duel",
        title=request.title.strip(),
        week_start=current_week_start(),
        target_sessions=request.target_sessions,
        status="pending",
        meta_json=json.dumps(
            {
                "duration_days": request.duration_days,
                "credited_sessions": {},
                "invitee_user_id": invitee_id,
                "invited_at": utcnow().isoformat(),
            }
        ),
    )
    db.add(challenge)
    db.flush()
    db.add(
        SocialChallengeMember(
            challenge_id=challenge.id,
            user_id=owner.id,
            progress_sessions=0,
        )
    )
    db.commit()
    return challenge_response(db, challenge.id, current_user_id=owner.id)


def _open_invite_between(db: Session, user_a: int, user_b: int) -> SocialChallenge | None:
    rows = db.scalars(
        select(SocialChallenge).where(
            SocialChallenge.status == "pending",
            SocialChallenge.challenge_kind == "duel",
            SocialChallenge.owner_id.in_([user_a, user_b]),
        )
    ).all()
    for row in rows:
        meta = load_challenge_meta(row)
        invitee_id = meta.get("invitee_user_id")
        if {row.owner_id, invitee_id} != {user_a, user_b}:
            continue
        if invite_is_expired(meta):
            cancel_challenge(db, row, reason="invite_expired")
            continue
        return row
    return None


def _require_invitee(meta: dict, user: User) -> None:
    try:
        invitee_id = int(meta.get("invitee_user_id"))
    except (TypeError, ValueError):
        raise ChallengeNotInviteeError from None
    if user.id != invitee_id:
        raise ChallengeNotInviteeError


def _expire_invite_if_needed(db: Session, challenge: SocialChallenge) -> bool:
    if challenge.status != "pending" or not invite_is_expired(load_challenge_meta(challenge)):
        return False
    cancel_challenge(db, challenge, reason="invite_expired")
    return True
