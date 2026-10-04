from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import math
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SocialChallenge, SocialChallengeMember, utcnow
from app.services.progression_service import SESSION_XP_MINUTES_FLOOR

CHALLENGE_MIN_DURATION_SECONDS = SESSION_XP_MINUTES_FLOOR * 60
COMPLETED_VISIBLE_DAYS = 14
CANCELLED_VISIBLE = timedelta(hours=48)
INVITE_TTL = timedelta(hours=48)


def _as_utc_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def load_challenge_meta(row: SocialChallenge) -> dict[str, Any]:
    try:
        meta = json.loads(row.meta_json or "{}")
    except json.JSONDecodeError:
        meta = {}
    if not isinstance(meta, dict):
        meta = {}
    if not isinstance(meta.get("duration_days"), int):
        meta["duration_days"] = 7
    credited = meta.get("credited_sessions")
    if not isinstance(credited, dict):
        meta["credited_sessions"] = {}
    return meta


def save_challenge_meta(row: SocialChallenge, meta: dict[str, Any]) -> None:
    row.meta_json = json.dumps(meta)


def lock_challenge(db: Session, challenge_id: int) -> SocialChallenge | None:
    """Reloads the row under a write lock so concurrent session stops cannot overwrite each other's credit."""
    return db.get(SocialChallenge, challenge_id, with_for_update=True, populate_existing=True)


def involved_user_ids(row: SocialChallenge, members: list[SocialChallengeMember]) -> set[int]:
    involved = {row.owner_id, *(member.user_id for member in members)}
    invitee_id = invitee_user_id(load_challenge_meta(row))
    if invitee_id is not None:
        involved.add(invitee_id)
    return involved


def challenge_duration_days(meta: dict[str, Any]) -> int:
    return max(1, int(meta.get("duration_days") or 7))


def challenge_window_start(row: SocialChallenge) -> datetime:
    meta = load_challenge_meta(row)
    started_at = meta.get("started_at")
    if isinstance(started_at, str):
        try:
            return _as_utc_aware(datetime.fromisoformat(started_at))
        except ValueError:
            pass
    try:
        week_start = datetime.fromisoformat(row.week_start).replace(tzinfo=timezone.utc)
    except ValueError:
        week_start = _as_utc_aware(row.created_at)
    created = _as_utc_aware(row.created_at)
    return max(week_start, created)


def invite_expires_at(meta: dict[str, Any]) -> datetime | None:
    invited_at = meta.get("invited_at")
    if not isinstance(invited_at, str):
        return None
    try:
        return _as_utc_aware(datetime.fromisoformat(invited_at)) + INVITE_TTL
    except ValueError:
        return None


def invite_is_expired(meta: dict[str, Any], *, now: datetime | None = None) -> bool:
    expires_at = invite_expires_at(meta)
    if expires_at is None:
        return False
    return _as_utc_aware(now or utcnow()) >= expires_at


def challenge_window_end(row: SocialChallenge, meta: dict[str, Any]) -> datetime:
    return challenge_window_start(row) + timedelta(days=challenge_duration_days(meta))


def days_remaining(row: SocialChallenge, meta: dict[str, Any], *, now: datetime | None = None) -> int:
    if row.status != "active":
        return 0
    now = _as_utc_aware(now or utcnow())
    end = challenge_window_end(row, meta)
    if now >= end:
        return 0
    return max(0, math.ceil((end - now).total_seconds() / 86400))


def session_qualifies_for_challenge(
    *,
    stopped_at: datetime,
    duration_seconds: int,
    challenge: SocialChallenge,
    meta: dict[str, Any],
) -> bool:
    if int(duration_seconds or 0) < CHALLENGE_MIN_DURATION_SECONDS:
        return False
    ts = _as_utc_aware(stopped_at)
    start = challenge_window_start(challenge)
    end = challenge_window_end(challenge, meta)
    return start <= ts < end


def credited_session_ids(meta: dict[str, Any], user_id: int) -> list[int]:
    credited = meta.setdefault("credited_sessions", {})
    key = str(user_id)
    session_ids = credited.setdefault(key, [])
    if not isinstance(session_ids, list):
        session_ids = []
        credited[key] = session_ids
    return session_ids


def _credit_session(meta: dict[str, Any], user_id: int, session_id: int) -> bool:
    session_ids = credited_session_ids(meta, user_id)
    if session_id in session_ids:
        return False
    session_ids.append(session_id)
    return True


def _uncredit_session(meta: dict[str, Any], user_id: int, session_id: int) -> bool:
    session_ids = credited_session_ids(meta, user_id)
    if session_id not in session_ids:
        return False
    session_ids.remove(session_id)
    return True


def _leader_member(members: list[SocialChallengeMember]) -> SocialChallengeMember | None:
    if not members:
        return None
    top = max(m.progress_sessions for m in members)
    leaders = [m for m in members if m.progress_sessions == top]
    if len(leaders) == 1:
        return leaders[0]
    return None


def cancel_challenge(
    db: Session,
    challenge: SocialChallenge,
    *,
    reason: str = "cancelled",
    actor_user_id: int | None = None,
) -> None:
    if challenge.status not in {"active", "pending"}:
        return
    meta = load_challenge_meta(challenge)
    challenge.status = "cancelled"
    meta["completion_reason"] = reason
    meta["cancelled_at"] = _as_utc_aware(utcnow()).isoformat()
    meta["cancelled_by_user_id"] = actor_user_id
    save_challenge_meta(challenge, meta)


def complete_challenge(
    db: Session,
    challenge: SocialChallenge,
    *,
    winner_user_id: int | None,
    reason: str,
    is_tie: bool = False,
) -> None:
    if challenge.status != "active":
        return
    meta = load_challenge_meta(challenge)
    challenge.status = "completed"
    meta["winner_user_id"] = winner_user_id
    meta["is_tie"] = bool(is_tie)
    meta["completion_reason"] = reason
    meta["completed_at"] = _as_utc_aware(utcnow()).isoformat()
    save_challenge_meta(challenge, meta)


def maybe_finalize_expired_challenge(db: Session, challenge: SocialChallenge) -> bool:
    if challenge.status != "active":
        return False
    if _as_utc_aware(utcnow()) < challenge_window_end(challenge, load_challenge_meta(challenge)):
        return False
    locked = lock_challenge(db, challenge.id)
    if locked is None or locked.status != "active":
        return False
    _complete_with_standings(db, locked, reason="time_expired")
    return True


def finish_if_target_reached(db: Session, challenge: SocialChallenge) -> bool:
    """Finishes a challenge whose target was lowered to or below the best progress."""
    if challenge.status != "active":
        return False
    members = _members_of(db, challenge.id)
    if max((member.progress_sessions for member in members), default=0) < challenge.target_sessions:
        return False
    _complete_with_standings(db, challenge, reason="target_reached", members=members)
    return True


def _complete_with_standings(
    db: Session,
    challenge: SocialChallenge,
    *,
    reason: str,
    members: list[SocialChallengeMember] | None = None,
) -> None:
    members = members if members is not None else _members_of(db, challenge.id)
    leader = _leader_member(members)
    is_tie = leader is None and len(members) > 1
    complete_challenge(
        db,
        challenge,
        winner_user_id=leader.user_id if leader else None,
        reason=reason,
        is_tie=is_tie,
    )


def _members_of(db: Session, challenge_id: int) -> list[SocialChallengeMember]:
    return list(
        db.scalars(select(SocialChallengeMember).where(SocialChallengeMember.challenge_id == challenge_id)).all()
    )


def sync_challenge_progress_on_session_complete(
    db: Session,
    *,
    user_id: int,
    session_id: int,
    stopped_at: datetime,
    duration_seconds: int,
) -> list[int]:
    """Credit completed sessions against active social challenges and finalize winners."""
    if int(duration_seconds or 0) < CHALLENGE_MIN_DURATION_SECONDS:
        return []

    completed_challenge_ids: list[int] = []
    for member in _active_challenge_memberships(db, user_id):
        completed_id = _credit_member_session(
            db,
            member=member,
            user_id=user_id,
            session_id=session_id,
            stopped_at=stopped_at,
            duration_seconds=duration_seconds,
        )
        if completed_id is not None:
            completed_challenge_ids.append(completed_id)
    return completed_challenge_ids


def _active_challenge_memberships(db: Session, user_id: int) -> list[SocialChallengeMember]:
    return list(
        db.scalars(
            select(SocialChallengeMember)
            .join(SocialChallenge, SocialChallenge.id == SocialChallengeMember.challenge_id)
            .where(
                SocialChallengeMember.user_id == user_id,
                SocialChallenge.status == "active",
            )
        ).all()
    )


def _credit_member_session(
    db: Session,
    *,
    member: SocialChallengeMember,
    user_id: int,
    session_id: int,
    stopped_at: datetime,
    duration_seconds: int,
) -> int | None:
    challenge = lock_challenge(db, member.challenge_id)
    if challenge is None or challenge.status != "active":
        return None
    meta = load_challenge_meta(challenge)
    if not session_qualifies_for_challenge(
        stopped_at=stopped_at,
        duration_seconds=duration_seconds,
        challenge=challenge,
        meta=meta,
    ) or not _credit_session(meta, user_id, session_id):
        return None

    save_challenge_meta(challenge, meta)
    member.progress_sessions = int(member.progress_sessions or 0) + 1
    member.updated_at = utcnow()
    db.flush()
    if member.progress_sessions < challenge.target_sessions:
        return None
    complete_challenge(
        db,
        challenge,
        winner_user_id=member.user_id,
        reason="target_reached",
        is_tie=False,
    )
    return challenge.id


def revoke_session_challenge_credit(db: Session, *, user_id: int, session_id: int) -> None:
    """Takes back the point a now-deleted session earned in still-running challenges."""
    for member in _active_challenge_memberships(db, user_id):
        challenge = lock_challenge(db, member.challenge_id)
        if challenge is None or challenge.status != "active":
            continue
        meta = load_challenge_meta(challenge)
        if not _uncredit_session(meta, user_id, session_id):
            continue
        save_challenge_meta(challenge, meta)
        member.progress_sessions = max(0, int(member.progress_sessions or 0) - 1)
        member.updated_at = utcnow()
    db.flush()


def finalize_visible_active_challenges(db: Session, challenges: list[SocialChallenge]) -> list[int]:
    """Returns the ids of challenges this call finished."""
    return [
        challenge.id
        for challenge in challenges
        if challenge.status == "active" and maybe_finalize_expired_challenge(db, challenge)
    ]


def challenge_completed_recently(meta: dict[str, Any]) -> bool:
    completed_at = meta_timestamp(meta, "completed_at")
    return completed_at is not None and _as_utc_aware(utcnow()) - completed_at <= timedelta(
        days=COMPLETED_VISIBLE_DAYS
    )


def challenge_cancelled_recently(meta: dict[str, Any]) -> bool:
    cancelled_at = meta_timestamp(meta, "cancelled_at")
    return cancelled_at is not None and _as_utc_aware(utcnow()) - cancelled_at <= CANCELLED_VISIBLE


def meta_timestamp(meta: dict[str, Any], key: str) -> datetime | None:
    raw = meta.get(key)
    if not raw:
        return None
    try:
        return _as_utc_aware(datetime.fromisoformat(str(raw)))
    except ValueError:
        return None


def challenge_public_extras(
    row: SocialChallenge,
    members: list[SocialChallengeMember],
    *,
    current_user_id: int | None = None,
) -> dict[str, Any]:
    meta = load_challenge_meta(row)
    leader = _leader_member(members)
    winner_user_id = meta.get("winner_user_id")
    if winner_user_id is not None:
        try:
            winner_user_id = int(winner_user_id)
        except (TypeError, ValueError):
            winner_user_id = None
    your_rank: int | None = None
    if current_user_id is not None:
        ordered = sorted(members, key=lambda m: m.progress_sessions, reverse=True)
        for idx, member in enumerate(ordered, start=1):
            if member.user_id == current_user_id:
                your_rank = idx
                break
    return {
        "days_remaining": days_remaining(row, meta),
        "leader_user_id": leader.user_id if leader else None,
        "winner_user_id": winner_user_id,
        "is_tie": bool(meta.get("is_tie")),
        "completion_reason": meta.get("completion_reason"),
        "your_rank": your_rank,
        "invitee_user_id": invitee_user_id(meta),
        "invite_expires_at": invite_expires_at(meta) if row.status == "pending" else None,
    }


def invitee_user_id(meta: dict[str, Any]) -> int | None:
    raw = meta.get("invitee_user_id")
    try:
        return int(raw) if raw is not None else None
    except (TypeError, ValueError):
        return None
