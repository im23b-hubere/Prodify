from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts.social import DuelRecordPublic
from app.models import SocialChallenge, SocialChallengeMember
from app.services.social_challenge_service import load_challenge_meta


def duel_records(db: Session, user_id: int) -> list[DuelRecordPublic]:
    """Lifetime head-to-head tally against every opponent of a finished duel."""
    finished_duels = _finished_duels_of(db, user_id)
    if not finished_duels:
        return []
    opponents = _opponents_by_challenge(db, [duel.id for duel in finished_duels], user_id)
    tallies: dict[int, DuelRecordPublic] = {}
    for duel in finished_duels:
        opponent_id = opponents.get(duel.id)
        if opponent_id is None:
            continue
        record = tallies.setdefault(opponent_id, DuelRecordPublic(friend_user_id=opponent_id))
        _count_result(record, load_challenge_meta(duel), user_id)
    return sorted(tallies.values(), key=lambda record: record.friend_user_id)


def _finished_duels_of(db: Session, user_id: int) -> list[SocialChallenge]:
    membership = select(SocialChallengeMember.challenge_id).where(SocialChallengeMember.user_id == user_id)
    return list(
        db.scalars(
            select(SocialChallenge).where(
                SocialChallenge.id.in_(membership),
                SocialChallenge.challenge_kind == "duel",
                SocialChallenge.status == "completed",
            )
        ).all()
    )


def _opponents_by_challenge(db: Session, challenge_ids: list[int], user_id: int) -> dict[int, int]:
    rows = db.execute(
        select(SocialChallengeMember.challenge_id, SocialChallengeMember.user_id).where(
            SocialChallengeMember.challenge_id.in_(challenge_ids),
            SocialChallengeMember.user_id != user_id,
        )
    ).all()
    return {challenge_id: opponent_id for challenge_id, opponent_id in rows}


def _count_result(record: DuelRecordPublic, meta: dict[str, Any], user_id: int) -> None:
    winner = _winner_user_id(meta)
    if meta.get("is_tie") or winner is None:
        record.ties += 1
    elif winner == user_id:
        record.wins += 1
    else:
        record.losses += 1


def _winner_user_id(meta: dict[str, Any]) -> int | None:
    try:
        return int(meta["winner_user_id"])
    except (KeyError, TypeError, ValueError):
        return None
