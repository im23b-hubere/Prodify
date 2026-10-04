"""Who hears about a finished or cancelled challenge, and what they are told (push + inbox)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SocialChallenge, SocialChallengeMember, User
from app.services.push_links import FRIENDS_PATH, challenge_path
from app.services.social_challenge_service import (
    invitee_user_id,
    involved_user_ids,
    load_challenge_meta,
    meta_timestamp,
)

SOMEONE = "A producer"


@dataclass(frozen=True)
class ChallengeMessage:
    kind: str
    title: str
    body: str
    title_key: str
    body_key: str
    route: str
    happened_at: datetime | None
    body_params: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class _ChallengeContext:
    challenge: SocialChallenge
    meta: dict
    members: list[SocialChallengeMember]
    usernames: dict[int, str]

    def name_of(self, user_id: int | None) -> str:
        return self.usernames.get(user_id, SOMEONE) if user_id is not None else SOMEONE


def challenge_messages(db: Session, challenge_id: int) -> list[tuple[int, ChallengeMessage]]:
    """One message per participant who should hear about the challenge's latest outcome."""
    context = _load_context(db, challenge_id)
    if context is None:
        return []
    if context.challenge.status == "completed":
        return _finished_messages(context)
    if context.challenge.status == "cancelled":
        return _cancelled_messages(context)
    return []


def _load_context(db: Session, challenge_id: int) -> _ChallengeContext | None:
    challenge = db.get(SocialChallenge, challenge_id)
    if challenge is None:
        return None
    meta = load_challenge_meta(challenge)
    members = list(
        db.scalars(select(SocialChallengeMember).where(SocialChallengeMember.challenge_id == challenge_id)).all()
    )
    named_ids = involved_user_ids(challenge, members)
    for key in ("cancelled_by_user_id", "winner_user_id"):
        user_id = _int_or_none(meta.get(key))
        if user_id is not None:
            named_ids.add(user_id)
    usernames = {user.id: user.username for user in db.scalars(select(User).where(User.id.in_(named_ids))).all()}
    return _ChallengeContext(challenge=challenge, meta=meta, members=members, usernames=usernames)


def _finished_messages(context: _ChallengeContext) -> list[tuple[int, ChallengeMessage]]:
    return [
        (member.user_id, message)
        for member in context.members
        if (message := _finished_message(context, member.user_id)) is not None
    ]


def _finished_message(context: _ChallengeContext, recipient_id: int) -> ChallengeMessage | None:
    title = context.challenge.title
    winner_id = _int_or_none(context.meta.get("winner_user_id"))
    happened_at = meta_timestamp(context.meta, "completed_at")
    route = challenge_path(context.challenge.id)
    if winner_id == recipient_id:
        return ChallengeMessage(
            kind="challenge_won",
            title="You won!",
            body=f"You won “{title}”. Nice work.",
            title_key="notificationsUi.challengeWonTitle",
            body_key="notificationsUi.challengeWonBody",
            body_params={"title": title},
            route=route,
            happened_at=happened_at,
        )
    if context.meta.get("is_tie"):
        return ChallengeMessage(
            kind="challenge_tied",
            title="It's a tie",
            body=f"“{title}” ended in a tie.",
            title_key="notificationsUi.challengeTiedTitle",
            body_key="notificationsUi.challengeTiedBody",
            body_params={"title": title},
            route=route,
            happened_at=happened_at,
        )
    if winner_id is None:
        return None
    winner = context.name_of(winner_id)
    return ChallengeMessage(
        kind="challenge_lost",
        title="Challenge over",
        body=f"{winner} won “{title}”. Time for a rematch?",
        title_key="notificationsUi.challengeLostTitle",
        body_key="notificationsUi.challengeLostBody",
        body_params={"username": winner, "title": title},
        route=route,
        happened_at=happened_at,
    )


_CANCELLED_COPY: dict[str, tuple[str, str, str]] = {
    "declined": ("challengeDeclined", "Duel declined", "{username} declined your duel."),
    "invite_expired": ("challengeExpired", "Invite expired", "{username} didn't answer your duel invite in time."),
    "withdrawn": ("challengeWithdrawn", "Invite withdrawn", "{username} withdrew their duel invite."),
    "member_left": ("challengeMemberLeft", "Challenge ended", "{username} left “{title}”."),
    "cancelled": ("challengeEnded", "Challenge ended", "{username} ended “{title}”."),
}


def _cancelled_messages(context: _ChallengeContext) -> list[tuple[int, ChallengeMessage]]:
    reason = str(context.meta.get("completion_reason") or "cancelled")
    copy = _CANCELLED_COPY.get(reason)
    if copy is None:
        return []
    key, title_text, body_template = copy
    named_user_id = _cancellation_subject(context, reason)
    params = {"username": context.name_of(named_user_id), "title": context.challenge.title}
    message = ChallengeMessage(
        kind=f"challenge_{reason}",
        title=title_text,
        body=body_template.format(**params),
        title_key=f"notificationsUi.{key}Title",
        body_key=f"notificationsUi.{key}Body",
        body_params=params,
        route=FRIENDS_PATH,
        happened_at=meta_timestamp(context.meta, "cancelled_at"),
    )
    return [(recipient_id, message) for recipient_id in sorted(_cancellation_recipients(context, reason))]


def _cancellation_subject(context: _ChallengeContext, reason: str) -> int | None:
    if reason == "invite_expired":
        return invitee_user_id(context.meta)
    return _int_or_none(context.meta.get("cancelled_by_user_id"))


def _cancellation_recipients(context: _ChallengeContext, reason: str) -> set[int]:
    if reason == "invite_expired":
        return {context.challenge.owner_id}
    actor_id = _int_or_none(context.meta.get("cancelled_by_user_id"))
    return involved_user_ids(context.challenge, context.members) - {actor_id}


def _int_or_none(raw: object) -> int | None:
    try:
        return int(raw) if raw is not None else None
    except (TypeError, ValueError):
        return None
