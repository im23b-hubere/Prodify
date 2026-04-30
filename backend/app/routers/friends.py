"""Friend requests, leaderboard among friends, and shared activity feed."""

from __future__ import annotations

import json
from datetime import timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Friendship, FriendshipStatus, GrowthEvent, ProductionSession, SocialComment, SocialReaction, Streak, User, utcnow
from app.schemas import (
    FriendActivityPublic,
    FriendIncomingPublic,
    FriendLeaderboardEntryPublic,
    FriendLeaderboardPublic,
    FriendPostAcceptActionPublic,
    FriendRequestCreate,
    FriendStatusPublic,
    FriendshipPublic,
)
from app.services.friend_graph import friend_user_ids as _friend_user_ids
from app.services.kpi_tracker import track_event
from app.services.progression_service import grant_xp
from app.services.streak_reconcile_service import compute_streak_counts_for_display
from app.services.streak_status_service import streak_status_for_days

router = APIRouter(prefix="/friends", tags=["friends"])


def _any_pair_row(db: Session, a: int, b: int) -> Friendship | None:
    return db.scalar(
        select(Friendship).where(
            or_(
                (Friendship.user_id == a) & (Friendship.friend_id == b),
                (Friendship.user_id == b) & (Friendship.friend_id == a),
            )
        )
    )


def _session_count_in_period(db: Session, user_id: int, period_days: int | None) -> int:
    q = select(ProductionSession).where(
        ProductionSession.user_id == user_id,
        ProductionSession.deleted_at.is_(None),
        ProductionSession.duration_seconds.is_not(None),
    )
    if period_days is not None:
        since = utcnow() - timedelta(days=period_days)
        q = q.where(ProductionSession.started_at >= since)
    return len(db.scalars(q).all())


def _session_count_between(db: Session, user_id: int, since, until) -> int:
    q = select(ProductionSession).where(
        ProductionSession.user_id == user_id,
        ProductionSession.deleted_at.is_(None),
        ProductionSession.duration_seconds.is_not(None),
        ProductionSession.started_at >= since,
        ProductionSession.started_at < until,
    )
    return len(db.scalars(q).all())


def _session_counts_by_user_since(db: Session, user_ids: list[int], since) -> dict[int, int]:
    if not user_ids:
        return {}
    rows = db.execute(
        select(ProductionSession.user_id, func.count(ProductionSession.id))
        .where(
            ProductionSession.user_id.in_(user_ids),
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.started_at >= since,
        )
        .group_by(ProductionSession.user_id)
    ).all()
    return {int(uid): int(cnt) for uid, cnt in rows}


def _session_counts_by_user_between(db: Session, user_ids: list[int], since, until) -> dict[int, int]:
    if not user_ids:
        return {}
    rows = db.execute(
        select(ProductionSession.user_id, func.count(ProductionSession.id))
        .where(
            ProductionSession.user_id.in_(user_ids),
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.started_at >= since,
            ProductionSession.started_at < until,
        )
        .group_by(ProductionSession.user_id)
    ).all()
    return {int(uid): int(cnt) for uid, cnt in rows}


def _streak_days(db: Session, user_id: int) -> int:
    row = db.scalar(select(Streak).where(Streak.user_id == user_id))
    if row is None:
        return 0
    return int(row.current_streak or 0)


def _streak_row(db: Session, user_id: int) -> Streak | None:
    return db.scalar(select(Streak).where(Streak.user_id == user_id))


@router.post("/request", response_model=FriendshipPublic, status_code=status.HTTP_201_CREATED)
def send_friend_request(
    body: FriendRequestCreate,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    uname = body.username.strip().lower()
    target = db.scalar(select(User).where(func.lower(User.username) == uname))
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current.id:
        raise HTTPException(status_code=400, detail="You cannot add yourself")

    existing = _any_pair_row(db, current.id, target.id)
    if existing is not None:
        if existing.status == FriendshipStatus.accepted:
            raise HTTPException(status_code=400, detail="You are already friends with this user")
        if existing.user_id == current.id:
            raise HTTPException(status_code=400, detail="Friend request already pending")
        raise HTTPException(
            status_code=400,
            detail="This user already sent you a request — open incoming requests to accept it.",
        )

    row = Friendship(user_id=current.id, friend_id=target.id, status=FriendshipStatus.pending)
    db.add(row)
    db.commit()
    db.refresh(row)
    track_event(db, "invite_sent", current.id, {"friend_id": target.id})
    db.commit()
    return row


@router.get("/status/{user_id}", response_model=FriendStatusPublic)
def friendship_status(
    user_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if user_id == current.id:
        return FriendStatusPublic(status="self", username=current.username)
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    uname = target.username
    row = _any_pair_row(db, current.id, user_id)
    if row is None:
        return FriendStatusPublic(status="none", username=uname)
    if row.status == FriendshipStatus.accepted:
        return FriendStatusPublic(status="accepted", username=uname)
    direction: Literal["outgoing", "incoming"] = (
        "outgoing" if row.user_id == current.id else "incoming"
    )
    return FriendStatusPublic(status="pending", username=uname, pending_direction=direction)


@router.get("/incoming", response_model=list[FriendIncomingPublic])
def list_incoming_requests(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    rows = db.scalars(
        select(Friendship)
        .where(
            Friendship.friend_id == current.id,
            Friendship.status == FriendshipStatus.pending,
        )
        .order_by(Friendship.created_at.desc())
    ).all()
    out: list[FriendIncomingPublic] = []
    for f in rows:
        u = db.get(User, f.user_id)
        if u is None:
            continue
        out.append(
            FriendIncomingPublic(
                id=f.id,
                user_id=f.user_id,
                username=u.username,
                created_at=f.created_at,
            )
        )
    return out


@router.post("/{friendship_id}/accept", response_model=FriendshipPublic)
def accept_friend_request(
    friendship_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(Friendship, friendship_id)
    if row is None or row.friend_id != current.id or row.status != FriendshipStatus.pending:
        raise HTTPException(status_code=404, detail="Friend request not found")
    row.status = FriendshipStatus.accepted
    requester = db.get(User, row.user_id)
    if requester is not None:
        requester.bonus_rescues = int(requester.bonus_rescues or 0) + 1
        requester.bonus_challenge_slots = int(requester.bonus_challenge_slots or 0) + 1
    current.bonus_rescues = int(current.bonus_rescues or 0) + 1
    current.bonus_challenge_slots = int(current.bonus_challenge_slots or 0) + 1
    grant_xp(
        db,
        current.id,
        10,
        source_type="friend_request_accept",
        source_id=str(row.id),
        meta={"friend_user_id": row.user_id},
    )
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_friendship(
    friendship_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(Friendship, friendship_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Friendship not found")
    if row.user_id != current.id and row.friend_id != current.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    db.delete(row)
    db.commit()
    return None


@router.get("/{friendship_id}/post-accept-actions", response_model=list[FriendPostAcceptActionPublic])
def post_accept_actions(
    friendship_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(Friendship, friendship_id)
    if row is None or row.status != FriendshipStatus.accepted:
        raise HTTPException(status_code=404, detail="Friendship not found")
    if row.user_id != current.id and row.friend_id != current.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return [
        FriendPostAcceptActionPublic(
            key="start_challenge",
            title="Start a shared challenge",
            cta_label="Create challenge",
            route_hint="/(tabs)/friends",
        ),
        FriendPostAcceptActionPublic(
            key="set_buddy",
            title="Become accountability buddies",
            cta_label="Invite as buddy",
            route_hint="/(tabs)/friends",
        ),
        FriendPostAcceptActionPublic(
            key="publish_commitment",
            title="Commit to this week's sessions",
            cta_label="Set commitment",
            route_hint="/(tabs)/friends",
        ),
    ]


@router.get("/leaderboard", response_model=FriendLeaderboardPublic)
def friends_leaderboard(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    period: str = "week",
):
    if period in ("7d", "week"):
        period_label = "week"
        period_days = 7
    elif period == "all":
        period_label = "all"
        period_days = None
    else:
        period_label = "week"
        period_days = 7

    friend_ids = _friend_user_ids(db, current.id)
    user_ids = [current.id, *friend_ids]
    user_rows = db.scalars(select(User).where(User.id.in_(user_ids))).all()
    users = {u.id: u for u in user_rows}

    now = utcnow()
    cur_counts: dict[int, int]
    prev_counts: dict[int, int] = {}
    if period_days is not None:
        since_cur = now - timedelta(days=period_days)
        cur_counts = _session_counts_by_user_since(db, user_ids, since_cur)
        until = now - timedelta(days=period_days)
        since_prev = until - timedelta(days=period_days)
        prev_counts = _session_counts_by_user_between(db, user_ids, since_prev, until)
    else:
        cur_counts = _session_counts_by_user_since(db, user_ids, now - timedelta(days=365 * 50))

    rows: list[tuple[int, str, int, int, bool, str | None, str, str, str]] = []
    for uid in user_ids:
        u = users.get(uid)
        if u is None:
            continue
        sc = int(cur_counts.get(uid, 0))
        st, _long = compute_streak_counts_for_display(db, uid)
        streak_row = _streak_row(db, uid)
        inactive_days = 0
        if streak_row and streak_row.last_session_date:
            inactive_days = max((utcnow().date() - streak_row.last_session_date.date()).days, 0)
        status_key, status_label, status_emoji = streak_status_for_days(st, inactive_days)
        rows.append(
            (
                uid,
                u.username,
                sc,
                st,
                bool(int(u.is_premium or 0)),
                u.profile_picture_url,
                status_key,
                status_label,
                status_emoji,
            )
        )

    rows.sort(key=lambda x: (x[2], x[3]), reverse=True)
    me_rank = None
    for idx, (uid, _, _, _, _, _, _, _, _) in enumerate(rows, start=1):
        if uid == current.id:
            me_rank = idx
            break

    entries: list[FriendLeaderboardEntryPublic] = []
    for rank, (uid, name, sc, st, is_premium, profile_picture_url, status_key, status_label, status_emoji) in enumerate(rows, start=1):
        delta = 0
        if period_days is not None:
            prev_sc = int(prev_counts.get(uid, 0))
            delta = sc - prev_sc
        entries.append(
            FriendLeaderboardEntryPublic(
                rank=rank,
                user_id=uid,
                username=name,
                current_streak_days=st,
                sessions_in_period=sc,
                sessions_delta_vs_prior=delta,
                trend="up" if delta > 0 else "down" if delta < 0 else "flat",
                is_chasing_you=bool(me_rank is not None and rank == me_rank - 1 and uid != current.id),
                is_threatening_you=bool(me_rank is not None and rank == me_rank + 1 and uid != current.id),
                is_premium=is_premium,
                profile_picture_url=profile_picture_url,
                streak_status_key=status_key,
                streak_status_label=status_label,
                streak_status_emoji=status_emoji,
            )
        )

    return FriendLeaderboardPublic(period=period_label, entries=entries)


@router.get("/activity", response_model=list[FriendActivityPublic])
def friends_activity(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 20,
):
    if limit < 1:
        limit = 1
    if limit > 50:
        limit = 50

    friend_ids = _friend_user_ids(db, current.id)
    scope = [current.id, *friend_ids]

    session_rows = db.scalars(
        select(ProductionSession)
        .where(
            ProductionSession.user_id.in_(scope),
            ProductionSession.deleted_at.is_(None),
            ProductionSession.stopped_at.is_not(None),
            ProductionSession.duration_seconds.is_not(None),
        )
        .order_by(func.coalesce(ProductionSession.stopped_at, ProductionSession.started_at).desc())
        .limit(limit * 2)
    ).all()
    growth_events = db.scalars(
        select(GrowthEvent)
        .where(
            GrowthEvent.user_id.in_(scope),
            GrowthEvent.event_name.in_(["streak_broken", "commitment_published"]),
        )
        .order_by(GrowthEvent.created_at.desc())
        .limit(limit * 2)
    ).all()
    session_ids = [row.id for row in session_rows]
    reactions_count_by_session: dict[int, int] = {}
    comments_count_by_session: dict[int, int] = {}
    viewer_reaction_by_session: dict[int, str] = {}
    if session_ids:
        reaction_rows = db.execute(
            select(SocialReaction.target_id, func.count(SocialReaction.id))
            .where(SocialReaction.target_type == "session", SocialReaction.target_id.in_(session_ids))
            .group_by(SocialReaction.target_id)
        ).all()
        reactions_count_by_session = {int(target_id): int(count) for target_id, count in reaction_rows}
        comment_rows = db.execute(
            select(SocialComment.target_id, func.count(SocialComment.id))
            .where(SocialComment.target_type == "session", SocialComment.target_id.in_(session_ids))
            .group_by(SocialComment.target_id)
        ).all()
        comments_count_by_session = {int(target_id): int(count) for target_id, count in comment_rows}
        viewer_rows = db.scalars(
            select(SocialReaction).where(
                SocialReaction.target_type == "session",
                SocialReaction.target_id.in_(session_ids),
                SocialReaction.user_id == current.id,
            )
        ).all()
        viewer_reaction_by_session = {int(row.target_id): row.emoji for row in viewer_rows}

    streak_rows = db.scalars(select(Streak).where(Streak.user_id.in_(scope))).all()
    streak_map = {row.user_id: row for row in streak_rows}
    user_cache = {}
    for u in db.scalars(select(User).where(User.id.in_(scope))).all():
        streak_row = streak_map.get(u.id)
        streak_days = int(streak_row.current_streak or 0) if streak_row else 0
        inactive_days = 0
        if streak_row and streak_row.last_session_date:
            inactive_days = max((utcnow().date() - streak_row.last_session_date.date()).days, 0)
        status_key, status_label, status_emoji = streak_status_for_days(streak_days, inactive_days)
        user_cache[u.id] = {
            "username": u.username,
            "profile_picture_url": u.profile_picture_url,
            "streak_status_key": status_key,
            "streak_status_label": status_label,
            "streak_status_emoji": status_emoji,
        }

    session_items: list[FriendActivityPublic] = []
    for s in session_rows:
        user_meta = user_cache.get(s.user_id, {})
        name = str(user_meta.get("username") or "?")
        profile_picture_url = user_meta.get("profile_picture_url")
        is_live = s.stopped_at is None
        activity_at = s.started_at if is_live else s.stopped_at
        if activity_at is None:
            activity_at = s.started_at
        session_items.append(
            FriendActivityPublic(
                session_id=s.id,
                user_id=s.user_id,
                username=name,
                profile_picture_url=str(profile_picture_url) if profile_picture_url else None,
                session_type=s.session_type,
                activity_at=activity_at,
                status="live" if is_live else "completed",
                completed_at=s.stopped_at,
                duration_seconds=(None if is_live else int(s.duration_seconds or 0)),
                reactions_count=reactions_count_by_session.get(s.id, 0),
                comments_count=comments_count_by_session.get(s.id, 0),
                viewer_reaction=viewer_reaction_by_session.get(s.id),
                streak_status_key=str(user_meta.get("streak_status_key") or "starting"),
                streak_status_label=str(user_meta.get("streak_status_label") or "STARTING"),
                streak_status_emoji=str(user_meta.get("streak_status_emoji") or "🌱"),
            )
        )
    event_items: list[FriendActivityPublic] = []
    for event in growth_events:
        user_meta = user_cache.get(int(event.user_id or 0), {})
        props: dict = {}
        try:
            parsed = json.loads(event.event_props_json or "{}")
            if isinstance(parsed, dict):
                props = parsed
        except json.JSONDecodeError:
            props = {}
        username = str(user_meta.get("username") or "?")
        if event.event_name == "streak_broken":
            streak_days = int(props.get("streak_days") or 0) if str(props.get("streak_days", "")).isdigit() else None
            base_message = f"{username}'s streak just ended"
            detail = f"{streak_days}-day streak ended 💔" if streak_days and streak_days > 0 else "Streak ended 💔"
            status = "streak_broken"
            session_type = "streak_broken"
            event_message = f"{base_message} · {detail}"
        else:
            streak_days = None
            target = int(props.get("target_sessions") or 0) if str(props.get("target_sessions", "")).isdigit() else 0
            witnesses = int(props.get("witness_count") or 0) if str(props.get("witness_count", "")).isdigit() else 0
            status = "commitment_published"
            session_type = "commitment_published"
            event_message = (
                f"{username} published a commitment: {target} sessions this week"
                + (f" · {witnesses} witnesses" if witnesses > 0 else "")
            )
        event_items.append(
            FriendActivityPublic(
                session_id=-int(event.id),
                user_id=int(event.user_id or 0),
                username=username,
                profile_picture_url=(
                    str(user_meta.get("profile_picture_url")) if user_meta.get("profile_picture_url") else None
                ),
                session_type=session_type,
                activity_at=event.created_at,
                status=status,
                completed_at=event.created_at,
                duration_seconds=None,
                reactions_count=0,
                comments_count=0,
                viewer_reaction=None,
                streak_status_key=str(user_meta.get("streak_status_key") or "starting"),
                streak_status_label=str(user_meta.get("streak_status_label") or "STARTING"),
                streak_status_emoji=str(user_meta.get("streak_status_emoji") or "🌱"),
                event_message=event_message,
                streak_break_days=streak_days,
            )
        )

    merged = [*session_items, *event_items]
    merged.sort(key=lambda item: item.activity_at, reverse=True)
    return merged[:limit]
