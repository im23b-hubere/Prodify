"""Friend requests, leaderboard among friends, and shared activity feed."""

from __future__ import annotations

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Friendship, FriendshipStatus, ProductionSession, Streak, User, utcnow
from app.schemas import (
    FriendActivityPublic,
    FriendIncomingPublic,
    FriendLeaderboardEntryPublic,
    FriendLeaderboardPublic,
    FriendRequestCreate,
    FriendStatusPublic,
    FriendshipPublic,
)

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


def _friend_user_ids(db: Session, user_id: int) -> list[int]:
    rows = db.scalars(
        select(Friendship).where(
            Friendship.status == FriendshipStatus.accepted,
            or_(Friendship.user_id == user_id, Friendship.friend_id == user_id),
        )
    ).all()
    out: list[int] = []
    for r in rows:
        out.append(r.friend_id if r.user_id == user_id else r.user_id)
    return out


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


def _streak_days(db: Session, user_id: int) -> int:
    row = db.scalar(select(Streak).where(Streak.user_id == user_id))
    if row is None:
        return 0
    return int(row.current_streak or 0)


@router.post("/request", response_model=FriendshipPublic, status_code=status.HTTP_201_CREATED)
def send_friend_request(
    body: FriendRequestCreate,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    uname = body.username.strip()
    target = db.scalar(select(User).where(User.username == uname))
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
    return row


@router.get("/status/{user_id}", response_model=FriendStatusPublic)
def friendship_status(
    user_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if user_id == current.id:
        return FriendStatusPublic(status="self")
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    row = _any_pair_row(db, current.id, user_id)
    if row is None:
        return FriendStatusPublic(status="none")
    if row.status == FriendshipStatus.accepted:
        return FriendStatusPublic(status="accepted")
    return FriendStatusPublic(status="pending")


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

    rows: list[tuple[int, str, int, int]] = []
    for uid in user_ids:
        u = users.get(uid)
        if u is None:
            continue
        sc = _session_count_in_period(db, uid, period_days)
        st = _streak_days(db, uid)
        rows.append((uid, u.username, sc, st))

    rows.sort(key=lambda x: (x[2], x[3]), reverse=True)

    entries: list[FriendLeaderboardEntryPublic] = []
    for rank, (uid, name, sc, st) in enumerate(rows, start=1):
        entries.append(
            FriendLeaderboardEntryPublic(
                rank=rank,
                user_id=uid,
                username=name,
                current_streak_days=st,
                sessions_in_period=sc,
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

    rows = db.scalars(
        select(ProductionSession)
        .where(
            ProductionSession.user_id.in_(scope),
            ProductionSession.deleted_at.is_(None),
            ProductionSession.stopped_at.is_not(None),
            ProductionSession.duration_seconds.is_not(None),
        )
        .order_by(ProductionSession.stopped_at.desc())
        .limit(limit)
    ).all()

    user_cache = {u.id: u.username for u in db.scalars(select(User).where(User.id.in_(scope))).all()}

    out: list[FriendActivityPublic] = []
    for s in rows:
        name = user_cache.get(s.user_id) or "?"
        out.append(
            FriendActivityPublic(
                session_id=s.id,
                user_id=s.user_id,
                username=name,
                session_type=s.session_type,
                completed_at=s.stopped_at,  # type: ignore[arg-type]
                duration_seconds=int(s.duration_seconds or 0),
            )
        )
    return out
