from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.dependencies_subscription import user_has_premium_access
from app.models import (
    BuddyRelationship,
    BuddyStatus,
    CheckinLog,
    CheckinPlan,
    Friendship,
    FriendshipStatus,
    GrowthEvent,
    ProductionSession,
    SocialChallenge,
    SocialChallengeMember,
    SocialComment,
    SocialCommitment,
    SocialReaction,
    Streak,
    StreakRescue,
    User,
    utcnow,
)
from app.schemas import (
    IdentityStatePublic,
    BuddyRiskPublic,
    BuddyInviteAcceptBody,
    BuddyInviteBody,
    BuddyStatusPublic,
    CheckinLogBody,
    CheckinPlanBody,
    CheckinDayStatePublic,
    CheckinStatusPublic,
    CommitmentBody,
    CommitmentPublic,
    SocialChallengeCreateBody,
    SocialChallengeJoinBody,
    SocialChallengeMemberPublic,
    SocialChallengePublic,
    SocialCommentBody,
    SocialCommentPublic,
    SocialLeaderboardContextEntry,
    SocialLeaderboardContextPublic,
    SocialReactionBody,
    SocialReactionPublic,
    SocialReactionUserPublic,
    SocialWeeklyRecapPublic,
    StreakRescueBody,
)
from app.services.friend_graph import friend_user_ids as _friend_user_ids
from app.services.identity_tags import social_identity_tags
from app.streakutil import dump_frozen_json, parse_frozen_json
from app.services.kpi_tracker import track_event
from app.services.push_dispatch import send_ping
from app.services.progression_service import grant_xp
from app.services.social_challenge_service import (
    challenge_completed_recently,
    challenge_duration_days,
    challenge_public_extras,
    finalize_visible_active_challenges,
    load_challenge_meta,
)

router = APIRouter(prefix="/social", tags=["social"])


def _week_start_key() -> str:
    d = utcnow().date()
    return (d - timedelta(days=d.weekday())).isoformat()


def _session_count_for_week(db: Session, user_id: int, week_start: str) -> int:
    try:
        week_start_dt = datetime.fromisoformat(week_start).replace(tzinfo=timezone.utc)
    except ValueError:
        return 0
    week_end_dt = week_start_dt + timedelta(days=7)
    return int(
        db.scalar(
            select(func.count())
            .select_from(ProductionSession)
            .where(
                ProductionSession.user_id == user_id,
                ProductionSession.deleted_at.is_(None),
                ProductionSession.duration_seconds.is_not(None),
                ProductionSession.started_at >= week_start_dt,
                ProductionSession.started_at < week_end_dt,
            )
        )
        or 0
    )


def _session_counts_for_week(db: Session, user_ids: list[int], week_start: str) -> dict[int, int]:
    if not user_ids:
        return {}
    try:
        week_start_dt = datetime.fromisoformat(week_start).replace(tzinfo=timezone.utc)
    except ValueError:
        return {uid: 0 for uid in user_ids}
    week_end_dt = week_start_dt + timedelta(days=7)
    rows = db.execute(
        select(ProductionSession.user_id, func.count())
        .where(
            ProductionSession.user_id.in_(user_ids),
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.started_at >= week_start_dt,
            ProductionSession.started_at < week_end_dt,
        )
        .group_by(ProductionSession.user_id)
    ).all()
    counts = {int(uid): int(count) for uid, count in rows}
    for uid in user_ids:
        counts.setdefault(uid, 0)
    return counts


def _current_buddy_row(db: Session, user_id: int) -> BuddyRelationship | None:
    rows = db.scalars(
        select(BuddyRelationship).where(
            or_(BuddyRelationship.requester_id == user_id, BuddyRelationship.addressee_id == user_id)
        )
    ).all()
    if not rows:
        return None

    # Deterministic priority:
    # 1) active relationships (most recently activated)
    # 2) pending incoming requests (most recent)
    # 3) pending outgoing requests (most recent)
    active_rows = [row for row in rows if row.status == BuddyStatus.active]
    if active_rows:
        active_rows.sort(key=lambda row: (row.activated_at or row.created_at, row.id), reverse=True)
        return active_rows[0]

    incoming_pending = [row for row in rows if row.status == BuddyStatus.pending and row.addressee_id == user_id]
    if incoming_pending:
        incoming_pending.sort(key=lambda row: (row.created_at, row.id), reverse=True)
        return incoming_pending[0]

    outgoing_pending = [row for row in rows if row.status == BuddyStatus.pending and row.requester_id == user_id]
    if outgoing_pending:
        outgoing_pending.sort(key=lambda row: (row.created_at, row.id), reverse=True)
        return outgoing_pending[0]

    rows.sort(key=lambda row: (row.created_at, row.id), reverse=True)
    return rows[0]


def _is_premium(db: Session, user: User) -> bool:
    return user_has_premium_access(db, user)


def _load_commitment_witness_config(db: Session, user_id: int, week_start: str, commitment_key: str) -> list[int]:
    rows = db.scalars(
        select(GrowthEvent)
        .where(
            GrowthEvent.user_id == user_id,
            GrowthEvent.event_name == "commitment_witness_config",
        )
        .order_by(GrowthEvent.created_at.desc())
    ).all()
    for row in rows:
        try:
            props = json.loads(row.event_props_json or "{}")
        except json.JSONDecodeError:
            continue
        if not isinstance(props, dict):
            continue
        if str(props.get("week_start")) != week_start or str(props.get("commitment_key")) != commitment_key:
            continue
        raw = props.get("witness_user_ids")
        if isinstance(raw, list):
            out: list[int] = []
            for item in raw:
                try:
                    uid = int(item)
                except (TypeError, ValueError):
                    continue
                if uid > 0:
                    out.append(uid)
            return sorted(set(out))
    return []


def _save_commitment_witness_config(
    db: Session,
    *,
    user_id: int,
    week_start: str,
    commitment_key: str,
    witness_user_ids: list[int],
) -> None:
    track_event(
        db,
        "commitment_witness_config",
        user_id=user_id,
        props={
            "week_start": week_start,
            "commitment_key": commitment_key,
            "witness_user_ids": witness_user_ids,
        },
    )
    # Intentionally no commit here; caller controls transaction boundaries.


def _witness_user_ids(
    db: Session,
    user_id: int,
    week_start: str,
    commitment_key: str,
    limit: int = 3,
) -> list[int]:
    friend_ids = _friend_user_ids(db, user_id)
    configured = _load_commitment_witness_config(db, user_id, week_start, commitment_key)
    if configured:
        filtered = [uid for uid in configured if uid in set(friend_ids)]
        return filtered[: max(0, limit)]
    return friend_ids[: max(0, limit)]


def _witness_usernames(db: Session, witness_ids: list[int]) -> list[str]:
    if not witness_ids:
        return []
    users = db.scalars(select(User).where(User.id.in_(witness_ids))).all()
    by_id = {u.id: u.username for u in users}
    return [by_id[uid] for uid in witness_ids if uid in by_id]


def _has_growth_event(
    db: Session,
    *,
    user_id: int,
    event_name: str,
    week_start: str,
    commitment_key: str,
    notify_kind: str,
    marker: str,
) -> bool:
    rows = db.scalars(
        select(GrowthEvent).where(
            GrowthEvent.user_id == user_id,
            GrowthEvent.event_name == event_name,
        )
    ).all()
    for row in rows:
        try:
            props = json.loads(row.event_props_json or "{}")
        except json.JSONDecodeError:
            continue
        if not isinstance(props, dict):
            continue
        if (
            str(props.get("week_start")) == week_start
            and str(props.get("commitment_key")) == commitment_key
            and str(props.get("notify_kind")) == notify_kind
            and str(props.get("marker")) == marker
        ):
            return True
    return False


def _notify_commitment_witnesses(
    db: Session,
    *,
    actor: User,
    week_start: str,
    commitment_key: str,
    target_sessions: int,
    current_sessions: int,
    status: str,
    notify_kind: str,
    marker: str,
) -> None:
    if _has_growth_event(
        db,
        user_id=actor.id,
        event_name="commitment_witness_notified",
        week_start=week_start,
        commitment_key=commitment_key,
        notify_kind=notify_kind,
        marker=marker,
    ):
        return

    witness_ids = _witness_user_ids(db, actor.id, week_start, commitment_key, limit=3)
    if notify_kind == "started":
        title = "New public commitment"
        body = f"{actor.username} committed to {target_sessions} sessions this week."
    elif notify_kind == "completed":
        title = "Commitment completed"
        body = f"{actor.username} completed their commitment ({current_sessions}/{target_sessions})."
    elif notify_kind == "behind":
        title = "Commitment at risk"
        body = f"{actor.username} is behind ({current_sessions}/{target_sessions}). Encourage them."
    else:
        title = "Commitment progress"
        body = f"{actor.username} is at {current_sessions}/{target_sessions} this week."

    for witness_id in witness_ids:
        send_ping(
            settings,
            db,
            witness_id,
            title,
            body,
            data={
                "kind": "commitment_witness",
                "notify_kind": notify_kind,
                "user_id": str(actor.id),
                "week_start": week_start,
                "commitment_key": commitment_key,
            },
        )

    track_event(
        db,
        "commitment_witness_notified",
        user_id=actor.id,
        props={
            "week_start": week_start,
            "commitment_key": commitment_key,
            "notify_kind": notify_kind,
            "marker": marker,
            "witness_count": len(witness_ids),
            "status": status,
        },
    )
    db.commit()


@router.get("/buddy", response_model=BuddyStatusPublic)
def buddy_status(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = _current_buddy_row(db, current.id)
    if row is None:
        return BuddyStatusPublic(status="none")
    buddy_id = row.addressee_id if row.requester_id == current.id else row.requester_id
    buddy = db.get(User, buddy_id)
    if row.status == BuddyStatus.active:
        wk = _week_start_key()
        return BuddyStatusPublic(
            invite_id=row.id,
            status="active",
            buddy_user_id=buddy_id,
            buddy_username=buddy.username if buddy else None,
            this_week_sessions=_session_count_for_week(db, current.id, wk),
            buddy_week_sessions=_session_count_for_week(db, buddy_id, wk),
        )
    return BuddyStatusPublic(
        invite_id=row.id,
        status="pending_outgoing" if row.requester_id == current.id else "pending_incoming",
        buddy_user_id=buddy_id,
        buddy_username=buddy.username if buddy else None,
    )


@router.post("/buddy/invite", response_model=BuddyStatusPublic)
def invite_buddy(
    body: BuddyInviteBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    target = db.get(User, body.friend_user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current.id:
        raise HTTPException(status_code=400, detail="You cannot invite yourself")
    is_friend = db.scalar(
        select(Friendship).where(
            Friendship.status == FriendshipStatus.accepted,
            or_(
                (Friendship.user_id == current.id) & (Friendship.friend_id == target.id),
                (Friendship.user_id == target.id) & (Friendship.friend_id == current.id),
            ),
        )
    )
    if is_friend is None:
        raise HTTPException(status_code=403, detail="Buddy invite requires friendship first")
    if _current_buddy_row(db, current.id) is not None or _current_buddy_row(db, target.id) is not None:
        raise HTTPException(status_code=409, detail="Either you or this friend already has a buddy")
    row = BuddyRelationship(requester_id=current.id, addressee_id=target.id, status=BuddyStatus.pending)
    db.add(row)
    db.commit()
    db.refresh(row)
    return BuddyStatusPublic(
        invite_id=row.id,
        status="pending_outgoing",
        buddy_user_id=target.id,
        buddy_username=target.username,
    )


@router.post("/buddy/accept", response_model=BuddyStatusPublic)
def accept_buddy_invite(
    body: BuddyInviteAcceptBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(BuddyRelationship, body.invite_id)
    if row is None or row.addressee_id != current.id or row.status != BuddyStatus.pending:
        raise HTTPException(status_code=404, detail="Buddy invite not found")
    row.status = BuddyStatus.active
    row.activated_at = utcnow()
    db.commit()
    requester = db.get(User, row.requester_id)
    wk = _week_start_key()
    return BuddyStatusPublic(
        invite_id=row.id,
        status="active",
        buddy_user_id=row.requester_id,
        buddy_username=requester.username if requester else None,
        this_week_sessions=_session_count_for_week(db, current.id, wk),
        buddy_week_sessions=_session_count_for_week(db, row.requester_id, wk),
    )


@router.post("/checkins/plan", response_model=CheckinStatusPublic)
def set_checkin_plan(
    body: CheckinPlanBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    wk = _week_start_key()
    row = db.scalar(select(CheckinPlan).where(CheckinPlan.user_id == current.id, CheckinPlan.week_start == wk))
    if row is None:
        row = CheckinPlan(user_id=current.id, week_start=wk)
        db.add(row)
    row.target_checkins = body.target_checkins
    db.commit()
    return checkin_status(current, db)


@router.post("/checkins/done", response_model=CheckinStatusPublic)
def mark_checkin_done(
    body: CheckinLogBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    day_key = utcnow().date().isoformat()
    row = db.scalar(select(CheckinLog).where(CheckinLog.user_id == current.id, CheckinLog.day_key == day_key))
    first_done_today = row is None or row.state != "done"
    if row is None:
        row = CheckinLog(user_id=current.id, day_key=day_key, state="done")
        db.add(row)
    row.state = "done"
    row.note = body.note
    if first_done_today:
        grant_xp(
            db,
            current.id,
            6,
            source_type="social_checkin_done",
            source_id=day_key,
            meta={"day_key": day_key},
        )
    db.commit()
    return checkin_status(current, db)


@router.get("/checkins/status", response_model=CheckinStatusPublic)
def checkin_status(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    wk = _week_start_key()
    plan = db.scalar(select(CheckinPlan).where(CheckinPlan.user_id == current.id, CheckinPlan.week_start == wk))
    target = int(plan.target_checkins if plan else 3)
    today = utcnow().date()
    week_days = [(today - timedelta(days=today.weekday())) + timedelta(days=i) for i in range(7)]
    keys = [d.isoformat() for d in week_days]
    logs = db.scalars(select(CheckinLog).where(CheckinLog.user_id == current.id, CheckinLog.day_key.in_(keys))).all()
    log_map = {row.day_key: row.state for row in logs}
    day_states: list[CheckinDayStatePublic] = []
    done = 0
    for k in keys:
        if log_map.get(k) == "done":
            state = "done"
            done += 1
        elif k >= today.isoformat():
            state = "open"
        else:
            state = "missed"
        day_states.append(CheckinDayStatePublic(day_key=k, state=state))
    return CheckinStatusPublic(
        week_start=wk,
        target_checkins=target,
        done_count=done,
        on_track=done >= min(target, max(1, today.weekday() + 1)),
        day_states=day_states,
    )


@router.post("/feed/{session_id}/comments", response_model=SocialCommentPublic)
def add_session_comment(
    session_id: int,
    body: SocialCommentBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    session_row = db.get(ProductionSession, session_id)
    if session_row is None or session_row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Session not found")
    allowed_ids = {current.id, *_friend_user_ids(db, current.id)}
    if session_row.user_id not in allowed_ids:
        raise HTTPException(status_code=403, detail="Not allowed")
    row = SocialComment(target_type="session", target_id=session_id, author_id=current.id, body=body.body.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    return SocialCommentPublic(
        id=row.id,
        target_type=row.target_type,
        target_id=row.target_id,
        author_id=row.author_id,
        author_username=current.username,
        author_profile_picture_url=current.profile_picture_url,
        body=row.body,
        created_at=row.created_at,
    )


@router.get("/feed/{session_id}/comments", response_model=list[SocialCommentPublic])
def list_session_comments(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    session_row = db.get(ProductionSession, session_id)
    if session_row is None or session_row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Session not found")
    allowed_ids = {current.id, *_friend_user_ids(db, current.id)}
    if session_row.user_id not in allowed_ids:
        raise HTTPException(status_code=403, detail="Not allowed")
    rows = db.scalars(
        select(SocialComment)
        .where(SocialComment.target_type == "session", SocialComment.target_id == session_id)
        .order_by(SocialComment.created_at.asc())
        .limit(80)
    ).all()
    users = {
        u.id: {"username": u.username, "profile_picture_url": u.profile_picture_url}
        for u in db.scalars(select(User).where(User.id.in_([r.author_id for r in rows]))).all()
    }
    return [
        SocialCommentPublic(
            id=r.id,
            target_type=r.target_type,
            target_id=r.target_id,
            author_id=r.author_id,
            author_username=str(users.get(r.author_id, {}).get("username", "?")),
            author_profile_picture_url=(
                str(users.get(r.author_id, {}).get("profile_picture_url"))
                if users.get(r.author_id, {}).get("profile_picture_url")
                else None
            ),
            body=r.body,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/feed/{session_id}/reactions", response_model=list[SocialReactionPublic])
def react_to_session(
    session_id: int,
    body: SocialReactionBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    session_row = db.get(ProductionSession, session_id)
    if session_row is None or session_row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Session not found")
    emoji = body.emoji.strip() or "👍"
    allowed_ids = {current.id, *_friend_user_ids(db, current.id)}
    if session_row.user_id not in allowed_ids:
        raise HTTPException(status_code=403, detail="Not allowed")
    existing = db.scalar(
        select(SocialReaction).where(
            SocialReaction.target_type == "session",
            SocialReaction.target_id == session_id,
            SocialReaction.user_id == current.id,
            SocialReaction.emoji == emoji,
        )
    )
    if existing is None:
        db.add(SocialReaction(target_type="session", target_id=session_id, user_id=current.id, emoji=emoji))
    else:
        db.delete(existing)
    db.commit()
    return list_session_reactions(session_id, current, db)


@router.get("/feed/{session_id}/reactions", response_model=list[SocialReactionPublic])
def list_session_reactions(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    session_row = db.get(ProductionSession, session_id)
    if session_row is None or session_row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Session not found")
    allowed_ids = {current.id, *_friend_user_ids(db, current.id)}
    if session_row.user_id not in allowed_ids:
        raise HTTPException(status_code=403, detail="Not allowed")
    rows = db.scalars(
        select(SocialReaction).where(SocialReaction.target_type == "session", SocialReaction.target_id == session_id)
    ).all()
    by_emoji: dict[str, int] = defaultdict(int)
    mine: set[str] = set()
    for row in rows:
        by_emoji[row.emoji] += 1
        if row.user_id == current.id:
            mine.add(row.emoji)
    return [
        SocialReactionPublic(
            target_type="session",
            target_id=session_id,
            emoji=emoji,
            count=count,
            reacted_by_me=emoji in mine,
        )
        for emoji, count in sorted(by_emoji.items(), key=lambda x: x[1], reverse=True)
    ]


@router.get("/feed/{session_id}/reactions/users", response_model=list[SocialReactionUserPublic])
def list_session_reaction_users(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    session_row = db.get(ProductionSession, session_id)
    if session_row is None or session_row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Session not found")
    allowed_ids = {current.id, *_friend_user_ids(db, current.id)}
    if session_row.user_id not in allowed_ids:
        raise HTTPException(status_code=403, detail="Not allowed")
    rows = db.scalars(
        select(SocialReaction)
        .where(SocialReaction.target_type == "session", SocialReaction.target_id == session_id)
        .order_by(SocialReaction.created_at.desc())
        .limit(60)
    ).all()
    users = {u.id: u.username for u in db.scalars(select(User).where(User.id.in_([r.user_id for r in rows]))).all()}
    return [
        SocialReactionUserPublic(
            user_id=r.user_id,
            username=users.get(r.user_id, "?"),
            emoji=r.emoji,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/challenges", response_model=SocialChallengePublic)
def create_social_challenge(
    body: SocialChallengeCreateBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    premium = _is_premium(db, current)
    active_owned = db.scalars(
        select(SocialChallenge).where(SocialChallenge.owner_id == current.id, SocialChallenge.status == "active")
    ).all()
    max_challenges = (3 if premium else 1) + int(current.bonus_challenge_slots or 0)
    if len(active_owned) >= max_challenges:
        raise HTTPException(
            status_code=402,
            detail="Upgrade to create multiple challenges and run parallel accountability loops.",
        )
    if not premium and body.duration_days > 7:
        raise HTTPException(status_code=402, detail="Upgrade to run longer challenges.")
    wk = _week_start_key()
    requested_member_ids = sorted({uid for uid in body.member_user_ids if uid != current.id})
    if len(requested_member_ids) > 12:
        raise HTTPException(status_code=400, detail="Too many challenge participants requested")
    if requested_member_ids:
        existing_ids = set(
            db.scalars(select(User.id).where(User.id.in_(requested_member_ids))).all()
        )
        missing = [uid for uid in requested_member_ids if uid not in existing_ids]
        if missing:
            raise HTTPException(status_code=404, detail="One or more challenge members do not exist")
        friend_ids = set(_friend_user_ids(db, current.id))
        invalid = [uid for uid in requested_member_ids if uid not in friend_ids]
        if invalid:
            raise HTTPException(status_code=403, detail="Challenge members must be accepted friends")
    row = SocialChallenge(
        owner_id=current.id,
        challenge_kind=body.challenge_kind,
        title=body.title.strip(),
        week_start=wk,
        target_sessions=body.target_sessions,
        status="active",
        meta_json=json.dumps({"duration_days": body.duration_days, "credited_sessions": {}}),
    )
    db.add(row)
    db.flush()
    participants = [current.id, *requested_member_ids]
    for uid in sorted(set(participants)):
        db.add(SocialChallengeMember(challenge_id=row.id, user_id=uid, progress_sessions=0))
    db.commit()
    return _challenge_public(db, row.id, current_user_id=current.id)


def _challenge_public(
    db: Session,
    challenge_id: int,
    *,
    current_user_id: int | None = None,
) -> SocialChallengePublic:
    row = db.get(SocialChallenge, challenge_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Challenge not found")
    members = db.scalars(
        select(SocialChallengeMember).where(SocialChallengeMember.challenge_id == challenge_id)
    ).all()
    users = {u.id: u.username for u in db.scalars(select(User).where(User.id.in_([m.user_id for m in members]))).all()}
    meta = load_challenge_meta(row)
    duration_days = challenge_duration_days(meta)
    extras = challenge_public_extras(row, members, current_user_id=current_user_id)
    owner = db.get(User, row.owner_id)
    premium = bool(owner and _is_premium(db, owner))
    return SocialChallengePublic(
        id=row.id,
        challenge_kind=row.challenge_kind,
        title=row.title,
        week_start=row.week_start,
        target_sessions=row.target_sessions,
        duration_days=duration_days,
        status=row.status,
        premium_detail_locked=not premium,
        upsell_hint=None if premium else "Unlock multi-challenge stats and longer durations with Premium.",
        members=[
            SocialChallengeMemberPublic(
                user_id=m.user_id,
                username=users.get(m.user_id, "?"),
                progress_sessions=m.progress_sessions,
                team_label=m.team_label,
            )
            for m in sorted(members, key=lambda x: x.progress_sessions, reverse=True)
        ],
        **extras,
    )


@router.post("/challenges/join", response_model=SocialChallengePublic)
def join_social_challenge(
    body: SocialChallengeJoinBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(SocialChallenge, body.challenge_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Challenge not found")
    member = db.scalar(
        select(SocialChallengeMember).where(
            SocialChallengeMember.challenge_id == row.id, SocialChallengeMember.user_id == current.id
        )
    )
    if member is None:
        if row.status != "active":
            raise HTTPException(status_code=400, detail="Challenge is no longer active")
        if row.owner_id != current.id:
            friend_ids = set(_friend_user_ids(db, current.id))
            if row.owner_id not in friend_ids:
                raise HTTPException(status_code=403, detail="You are not allowed to join this challenge")
        db.add(SocialChallengeMember(challenge_id=row.id, user_id=current.id, progress_sessions=0))
        grant_xp(
            db,
            current.id,
            8,
            source_type="social_challenge_join",
            source_id=str(row.id),
            meta={"challenge_id": row.id},
        )
        db.commit()
    return _challenge_public(db, row.id, current_user_id=current.id)


@router.get("/challenges", response_model=list[SocialChallengePublic])
def list_social_challenges(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    rows = db.scalars(
        select(SocialChallenge)
        .order_by(SocialChallenge.created_at.desc())
        .limit(40)
    ).all()
    friend_ids = set(_friend_user_ids(db, current.id))
    visible = [r for r in rows if r.owner_id == current.id or r.owner_id in friend_ids]
    active_visible = [r for r in visible if r.status == "active"]
    finalize_visible_active_challenges(db, active_visible)
    db.commit()
    listed: list[SocialChallenge] = []
    for row in visible:
        if row.status == "active":
            listed.append(row)
            continue
        if row.status == "completed" and challenge_completed_recently(load_challenge_meta(row)):
            listed.append(row)
    listed = listed[:20]
    return [_challenge_public(db, r.id, current_user_id=current.id) for r in listed]


@router.post("/commitment", response_model=CommitmentPublic)
def set_commitment(
    body: CommitmentBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    premium = _is_premium(db, current)
    if not premium and body.period_days > 7:
        raise HTTPException(status_code=402, detail="Track longer commitment windows with Premium.")
    if not premium and body.commitment_key != "sessions":
        raise HTTPException(status_code=402, detail="Track multiple commitments with Premium.")
    wk = _week_start_key()
    requested_witnesses = sorted({int(uid) for uid in body.witness_user_ids if int(uid) > 0 and int(uid) != current.id})
    if len(requested_witnesses) > 3:
        raise HTTPException(status_code=400, detail="Pick up to 3 witnesses")
    friend_ids = set(_friend_user_ids(db, current.id))
    invalid_witnesses = [uid for uid in requested_witnesses if uid not in friend_ids]
    if invalid_witnesses:
        raise HTTPException(status_code=403, detail="Witnesses must be accepted friends")
    row = db.scalar(
        select(SocialCommitment).where(
            SocialCommitment.user_id == current.id,
            SocialCommitment.week_start == wk,
            SocialCommitment.commitment_key == body.commitment_key,
        )
    )
    if row is None:
        row = SocialCommitment(user_id=current.id, week_start=wk)
        db.add(row)
        grant_xp(
            db,
            current.id,
            5,
            source_type="social_commitment_set",
            source_id=f"{wk}:{body.commitment_key}",
            meta={"week_start": wk, "commitment_key": body.commitment_key},
        )
    row.target_sessions = body.target_sessions
    row.visibility = body.visibility
    row.commitment_key = body.commitment_key
    row.period_days = body.period_days
    _save_commitment_witness_config(
        db,
        user_id=current.id,
        week_start=wk,
        commitment_key=row.commitment_key,
        witness_user_ids=requested_witnesses,
    )
    track_event(
        db,
        "commitment_published",
        user_id=current.id,
        props={
            "week_start": wk,
            "commitment_key": row.commitment_key,
            "target_sessions": row.target_sessions,
            "witness_count": len(requested_witnesses),
            "witness_user_ids": requested_witnesses,
        },
    )
    db.commit()
    _notify_commitment_witnesses(
        db,
        actor=current,
        week_start=wk,
        commitment_key=row.commitment_key,
        target_sessions=row.target_sessions,
        current_sessions=0,
        status="on_track",
        notify_kind="started",
        marker=f"target:{row.target_sessions}",
    )
    return commitment_status(current, db)


@router.get("/commitment", response_model=CommitmentPublic | None)
def commitment_status(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    commitment_key: str = "sessions",
):
    wk = _week_start_key()
    premium = _is_premium(db, current)
    row = db.scalar(
        select(SocialCommitment).where(
            SocialCommitment.user_id == current.id,
            SocialCommitment.week_start == wk,
            SocialCommitment.commitment_key == commitment_key,
        )
    )
    if row is None:
        return None
    cur = _session_count_for_week(db, current.id, wk)
    if cur >= row.target_sessions:
        status = "completed"
    elif cur + 1 >= max(1, (utcnow().date().weekday() + 1) * row.target_sessions // 7):
        status = "on_track"
    else:
        status = "behind"
    witness_ids = _witness_user_ids(db, current.id, wk, row.commitment_key, limit=3)
    witness_names = _witness_usernames(db, witness_ids)
    return CommitmentPublic(
        week_start=wk,
        commitment_key=row.commitment_key,
        period_days=int(row.period_days or 7),
        target_sessions=row.target_sessions,
        current_sessions=cur,
        status=status,
        visibility=row.visibility,
        upsell_hint=None if premium else "Track more goals with Premium.",
        witness_user_ids=witness_ids,
        witness_usernames=witness_names,
    )


@router.get("/commitments", response_model=list[CommitmentPublic])
def list_commitments(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    wk = _week_start_key()
    premium = _is_premium(db, current)
    rows = db.scalars(select(SocialCommitment).where(SocialCommitment.user_id == current.id, SocialCommitment.week_start == wk)).all()
    out: list[CommitmentPublic] = []
    cur = _session_count_for_week(db, current.id, wk)
    for row in rows:
        if cur >= row.target_sessions:
            status = "completed"
        elif cur + 1 >= max(1, (utcnow().date().weekday() + 1) * row.target_sessions // 7):
            status = "on_track"
        else:
            status = "behind"
        witnesses = _witness_user_ids(db, current.id, wk, row.commitment_key, limit=3)
        out.append(
            CommitmentPublic(
                week_start=wk,
                commitment_key=row.commitment_key,
                period_days=int(row.period_days or 7),
                target_sessions=row.target_sessions,
                current_sessions=cur,
                status=status,
                visibility=row.visibility,
                upsell_hint=None if premium else "Track more goals with Premium.",
                witness_user_ids=witnesses,
                witness_usernames=_witness_usernames(db, witnesses),
            )
        )
    return out


@router.post("/streak/rescue", response_model=dict[str, str | int])
def rescue_streak(
    body: StreakRescueBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    premium = _is_premium(db, current)
    buddy_row = _current_buddy_row(db, current.id)
    if buddy_row is None or buddy_row.status != BuddyStatus.active:
        raise HTTPException(status_code=403, detail="Only active buddies can rescue streaks")
    buddy_id = buddy_row.addressee_id if buddy_row.requester_id == current.id else buddy_row.requester_id
    if body.rescued_user_id != buddy_id:
        raise HTTPException(status_code=403, detail="You can only rescue your buddy")
    today = utcnow().date().isoformat()
    already = db.scalar(
        select(StreakRescue).where(StreakRescue.rescued_user_id == buddy_id, StreakRescue.day_key == today)
    )
    if already is not None:
        raise HTTPException(status_code=400, detail="Buddy streak already rescued today")
    rescuer_week_rescues = db.scalars(
        select(StreakRescue).where(StreakRescue.rescuer_user_id == current.id)
    ).all()
    wk = _week_start_key()
    this_week_rescues = sum(
        1 for r in rescuer_week_rescues if (r.created_at.date() - timedelta(days=r.created_at.date().weekday())).isoformat() == wk
    )
    limit = (3 if premium else 1) + int(current.bonus_rescues or 0)
    if this_week_rescues >= limit:
        raise HTTPException(status_code=402, detail="Keep your creative run alive with Premium to unlock more saves.")
    streak = db.scalar(select(Streak).where(Streak.user_id == buddy_id))
    if streak is None:
        raise HTTPException(status_code=404, detail="Buddy streak not found")
    frozen = parse_frozen_json(streak.frozen_day_keys)
    if today not in frozen:
        frozen.append(today)
        streak.frozen_day_keys = dump_frozen_json(frozen)
    db.add(StreakRescue(rescued_user_id=buddy_id, rescuer_user_id=current.id, day_key=today))
    grant_xp(
        db,
        current.id,
        12,
        source_type="social_streak_rescue",
        source_id=f"{buddy_id}:{today}",
        meta={"rescued_user_id": buddy_id, "day_key": today},
    )
    db.commit()
    return {"message": "Buddy streak rescued", "rescued_user_id": buddy_id}


@router.post("/streak/encourage", response_model=dict[str, str | int])
def encourage_streak_restart(
    body: StreakRescueBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    target = db.get(User, body.rescued_user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current.id:
        raise HTTPException(status_code=400, detail="Cannot encourage yourself")
    if body.rescued_user_id not in set(_friend_user_ids(db, current.id)):
        raise HTTPException(status_code=403, detail="You can only encourage friends")

    title = "Your crew has your back"
    body_text = f"{current.username} sent support after your streak break. Start fresh today."
    send_ping(
        settings,
        db,
        target.id,
        title,
        body_text,
        data={"kind": "streak_encouragement", "from_user_id": str(current.id)},
    )
    track_event(
        db,
        "streak_encouragement_sent",
        user_id=current.id,
        props={"target_user_id": target.id},
    )
    db.commit()
    return {"message": "Encouragement sent", "rescued_user_id": target.id}


@router.get("/weekly-recap", response_model=SocialWeeklyRecapPublic)
def weekly_social_recap(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    premium = _is_premium(db, current)
    wk = _week_start_key()
    my_count = _session_count_for_week(db, current.id, wk)
    buddy = buddy_status(current, db)
    buddy_count = buddy.buddy_week_sessions if buddy.status == "active" else 0
    friend_ids = _friend_user_ids(db, current.id)
    team_counts = _session_counts_for_week(db, friend_ids, wk)
    team_total = sum(team_counts.values())
    prev_wk = (utcnow().date() - timedelta(days=7) - timedelta(days=(utcnow().date() - timedelta(days=7)).weekday())).isoformat()
    prev = _session_count_for_week(db, current.id, prev_wk)
    wow = my_count - prev
    trend_pct = None
    if prev > 0:
        trend_pct = round(((my_count - prev) / prev) * 100, 1)
    identity_tags = social_identity_tags(db, current.id, week_start=wk)
    return SocialWeeklyRecapPublic(
        week_start=wk,
        your_sessions=my_count,
        buddy_sessions=buddy_count,
        team_sessions=team_total,
        wow_delta_sessions=wow,
        has_active_buddy=buddy.status == "active",
        identity_tag=identity_tags[0] if identity_tags else None,
        trend_vs_last_week_percent=trend_pct if premium else None,
        premium_detail_locked=not premium,
        upsell_hint=None if premium else "Unlock full social insights with Premium.",
    )


@router.get("/buddy/risk", response_model=BuddyRiskPublic)
def buddy_risk(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    premium = _is_premium(db, current)
    b = buddy_status(current, db)
    if b.status != "active" or b.buddy_user_id is None:
        return BuddyRiskPublic()
    buddy_id = b.buddy_user_id
    today = utcnow().date().isoformat()
    streak = db.scalar(select(Streak).where(Streak.user_id == buddy_id))
    session_today = db.scalar(
        select(ProductionSession).where(
            ProductionSession.user_id == buddy_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.started_at >= utcnow().replace(hour=0, minute=0, second=0, microsecond=0),
        )
    )
    frozen_today = False
    if streak is not None:
        frozen_today = today in set(parse_frozen_json(streak.frozen_day_keys))
    at_risk = bool(streak is not None and int(streak.current_streak or 0) > 0 and session_today is None and not frozen_today)
    rescued_today = (
        db.scalar(select(StreakRescue).where(StreakRescue.rescued_user_id == buddy_id, StreakRescue.day_key == today))
        is not None
    )
    my_week_rescues = db.scalars(select(StreakRescue).where(StreakRescue.rescuer_user_id == current.id)).all()
    wk = _week_start_key()
    used_rescue_week_count = sum(
        1 for r in my_week_rescues if (r.created_at.date() - timedelta(days=r.created_at.date().weekday())).isoformat() == wk
    )
    rescue_limit = (3 if premium else 1) + int(current.bonus_rescues or 0)
    return BuddyRiskPublic(
        buddy_user_id=buddy_id,
        buddy_username=b.buddy_username,
        buddy_streak_at_risk=at_risk,
        rescue_available=at_risk and not rescued_today and used_rescue_week_count < rescue_limit,
        rescued_today=rescued_today,
    )


@router.get("/leaderboard/context", response_model=SocialLeaderboardContextPublic)
def leaderboard_context(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    wk = _week_start_key()
    user_ids = [current.id, *_friend_user_ids(db, current.id)]
    users = {u.id: u.username for u in db.scalars(select(User).where(User.id.in_(user_ids))).all()}
    rows: list[tuple[int, str, int, int]] = []
    prev_wk = (utcnow().date() - timedelta(days=7) - timedelta(days=(utcnow().date() - timedelta(days=7)).weekday())).isoformat()
    cur_counts = _session_counts_for_week(db, user_ids, wk)
    prev_counts = _session_counts_for_week(db, user_ids, prev_wk)
    for uid in user_ids:
        rows.append((uid, users.get(uid, "?"), cur_counts.get(uid, 0), prev_counts.get(uid, 0)))
    rows.sort(key=lambda r: r[2], reverse=True)
    entries = []
    my_rank = None
    for idx, (uid, name, cur, prev) in enumerate(rows, start=1):
        if uid == current.id:
            my_rank = idx
        movement = cur - prev
        entries.append(
            SocialLeaderboardContextEntry(
                user_id=uid,
                username=name,
                rank=idx,
                sessions=cur,
                movement=movement,
                trend="up" if movement > 0 else "down" if movement < 0 else "flat",
            )
        )
    chasing = None
    threatening = None
    if my_rank is not None:
        for e in entries:
            if e.rank == my_rank - 1:
                chasing = e.user_id
            if e.rank == my_rank + 1:
                threatening = e.user_id
    return SocialLeaderboardContextPublic(
        entries=entries,
        chasing_user_id=chasing,
        threatening_user_id=threatening,
    )


@router.get("/identity", response_model=IdentityStatePublic)
def identity_state(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    wk = _week_start_key()
    tags = social_identity_tags(db, current.id, week_start=wk)
    primary = tags[0]
    secondary = tags[1] if len(tags) > 1 else None
    lines = {
        "creator": "You're shaping your sound.",
        "consistent_creator": "You've been consistently producing this week.",
        "collaborative": "You're keeping your producer circle active.",
        "competitive": "You're in a close creative battle - keep pushing.",
        "locked_in": "You're in a creative flow right now.",
        "building_momentum": "You're getting back into your flow.",
    }
    return IdentityStatePublic(
        primary_tag=primary,
        secondary_tag=secondary,
        tags=tags,
        line=lines.get(primary, "You're building momentum."),
    )
