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


def challenge_duration_days(meta: dict[str, Any]) -> int:
    return max(1, int(meta.get("duration_days") or 7))


def challenge_window_start(row: SocialChallenge) -> datetime:
    try:
        week_start = datetime.fromisoformat(row.week_start).replace(tzinfo=timezone.utc)
    except ValueError:
        week_start = _as_utc_aware(row.created_at)
    created = _as_utc_aware(row.created_at)
    return max(week_start, created)


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


def _credit_session(meta: dict[str, Any], user_id: int, session_id: int) -> bool:
    credited = meta.setdefault("credited_sessions", {})
    key = str(user_id)
    session_ids = credited.setdefault(key, [])
    if not isinstance(session_ids, list):
        session_ids = []
        credited[key] = session_ids
    if session_id in session_ids:
        return False
    session_ids.append(session_id)
    return True


def _leader_member(members: list[SocialChallengeMember]) -> SocialChallengeMember | None:
    if not members:
        return None
    top = max(m.progress_sessions for m in members)
    leaders = [m for m in members if m.progress_sessions == top]
    if len(leaders) == 1:
        return leaders[0]
    return None


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
    meta = load_challenge_meta(challenge)
    if _as_utc_aware(utcnow()) < challenge_window_end(challenge, meta):
        return False
    members = db.scalars(
        select(SocialChallengeMember).where(SocialChallengeMember.challenge_id == challenge.id)
    ).all()
    leader = _leader_member(members)
    if leader is None:
        top = max((m.progress_sessions for m in members), default=0)
        tie = len([m for m in members if m.progress_sessions == top]) > 1 if members else False
        complete_challenge(db, challenge, winner_user_id=None, reason="time_expired", is_tie=tie)
    else:
        complete_challenge(
            db,
            challenge,
            winner_user_id=leader.user_id,
            reason="time_expired",
            is_tie=False,
        )
    return True


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
    memberships = db.scalars(
        select(SocialChallengeMember)
        .join(SocialChallenge, SocialChallenge.id == SocialChallengeMember.challenge_id)
        .where(
            SocialChallengeMember.user_id == user_id,
            SocialChallenge.status == "active",
        )
    ).all()

    for member in memberships:
        challenge = db.get(SocialChallenge, member.challenge_id)
        if challenge is None or challenge.status != "active":
            continue
        meta = load_challenge_meta(challenge)
        if not session_qualifies_for_challenge(
            stopped_at=stopped_at,
            duration_seconds=duration_seconds,
            challenge=challenge,
            meta=meta,
        ):
            continue
        if not _credit_session(meta, user_id, session_id):
            continue
        save_challenge_meta(challenge, meta)
        member.progress_sessions = int(member.progress_sessions or 0) + 1
        member.updated_at = utcnow()
        db.flush()
        if member.progress_sessions >= challenge.target_sessions:
            complete_challenge(
                db,
                challenge,
                winner_user_id=member.user_id,
                reason="target_reached",
                is_tie=False,
            )
            completed_challenge_ids.append(challenge.id)

    return completed_challenge_ids


def finalize_visible_active_challenges(db: Session, challenges: list[SocialChallenge]) -> None:
    for challenge in challenges:
        if challenge.status == "active":
            maybe_finalize_expired_challenge(db, challenge)


def challenge_completed_recently(meta: dict[str, Any]) -> bool:
    if not meta.get("completed_at"):
        return False
    try:
        completed_at = datetime.fromisoformat(str(meta["completed_at"]))
        completed_at = _as_utc_aware(completed_at)
    except ValueError:
        return False
    return _as_utc_aware(utcnow()) - completed_at <= timedelta(days=COMPLETED_VISIBLE_DAYS)


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
    }
