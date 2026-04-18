from collections import Counter
from datetime import date
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ProductionSession, SessionType, User, utcnow
from app.timeutil import as_utc_aware
from app.schemas import (
    SessionPublic,
    SessionStart,
    SessionStatsPublic,
    SessionStatsSummary,
    SessionStatsTrendPoint,
    SessionStatsTypeBreakdownItem,
    SessionStop,
    SessionUpdate,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/start", response_model=SessionPublic, status_code=status.HTTP_201_CREATED)
def start_session(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    body: SessionStart | None = None,
):
    active = db.scalar(
        select(ProductionSession).where(
            ProductionSession.user_id == current.id,
            ProductionSession.stopped_at.is_(None),
            ProductionSession.deleted_at.is_(None),
        )
    )
    if active is not None:
        raise HTTPException(status_code=400, detail="You already have an active session")

    notes = body.notes if body else None
    session_type = body.session_type.value if body and body.session_type else SessionType.beat_making.value
    row = ProductionSession(user_id=current.id, started_at=utcnow(), notes=notes, session_type=session_type)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/stop", response_model=SessionPublic)
def stop_session(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    body: SessionStop,
):
    row = db.get(ProductionSession, body.session_id)
    if row is None or row.user_id != current.id or row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Session not found")
    if row.stopped_at is not None:
        raise HTTPException(status_code=400, detail="Session already stopped")

    end = utcnow()
    delta = end - as_utc_aware(row.started_at)
    row.stopped_at = end
    row.duration_seconds = max(0, int(delta.total_seconds()))
    db.commit()
    db.refresh(row)
    return row


@router.get("/list", response_model=list[SessionPublic])
def list_sessions(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
    offset: int = 0,
):
    if limit > 200:
        limit = 200
    rows = db.scalars(
        select(ProductionSession)
        .where(ProductionSession.user_id == current.id, ProductionSession.deleted_at.is_(None))
        .order_by(ProductionSession.started_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return list(rows)


@router.get("/trash", response_model=list[SessionPublic])
def list_deleted_sessions(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
    offset: int = 0,
):
    if limit > 200:
        limit = 200
    rows = db.scalars(
        select(ProductionSession)
        .where(ProductionSession.user_id == current.id, ProductionSession.deleted_at.is_not(None))
        .order_by(ProductionSession.started_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return list(rows)


@router.get("/item/{session_id}", response_model=SessionPublic)
def get_session(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(ProductionSession, session_id)
    if row is None or row.user_id != current.id:
        raise HTTPException(status_code=404, detail="Session not found")
    return row


@router.patch("/item/{session_id}", response_model=SessionPublic)
def update_session(
    session_id: int,
    body: SessionUpdate,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(ProductionSession, session_id)
    if row is None or row.user_id != current.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if row.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Deleted sessions cannot be edited")

    updates = body.model_dump(exclude_unset=True)
    if "session_type" in updates and updates["session_type"] is not None:
        row.session_type = updates["session_type"].value
    if "notes" in updates:
        row.notes = updates["notes"]

    db.commit()
    db.refresh(row)
    return row


@router.delete("/item/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(ProductionSession, session_id)
    if row is None or row.user_id != current.id or row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Session not found")
    row.deleted_at = utcnow()
    db.commit()
    return None


@router.post("/item/{session_id}/restore", response_model=SessionPublic)
def restore_session(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(ProductionSession, session_id)
    if row is None or row.user_id != current.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if row.deleted_at is None:
        raise HTTPException(status_code=400, detail="Session is not deleted")
    row.deleted_at = None
    db.commit()
    db.refresh(row)
    return row


@router.get("/stats", response_model=SessionStatsPublic)
def sessions_stats(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    period: str = "week",
):
    now = utcnow()
    period_days = {"week": 7, "month": 30}.get(period)
    since = now - timedelta(days=period_days) if period_days else None

    query = select(ProductionSession).where(
        ProductionSession.user_id == current.id,
        ProductionSession.deleted_at.is_(None),
    )
    if since is not None:
        query = query.where(ProductionSession.started_at >= since)
    rows = db.scalars(query.order_by(ProductionSession.started_at.asc())).all()

    completed = [row for row in rows if row.duration_seconds is not None]
    total_sessions = len(completed)
    total_seconds = int(sum((row.duration_seconds or 0) for row in completed))
    avg_session_seconds = int(total_seconds / total_sessions) if total_sessions > 0 else 0

    day_keys = sorted({as_utc_aware(row.started_at).date().isoformat() for row in rows})
    best_streak = 0
    if day_keys:
        streak = 1
        best_streak = 1
        for idx in range(1, len(day_keys)):
            prev = date.fromisoformat(day_keys[idx - 1])
            cur = date.fromisoformat(day_keys[idx])
            if (cur - prev).days == 1:
                streak += 1
                if streak > best_streak:
                    best_streak = streak
            else:
                streak = 1

    trend_map: dict[str, tuple[int, int]] = {}
    for row in completed:
        key = as_utc_aware(row.started_at).date().isoformat()
        sessions_count, seconds_count = trend_map.get(key, (0, 0))
        trend_map[key] = (sessions_count + 1, seconds_count + int(row.duration_seconds or 0))
    trend = [
        SessionStatsTrendPoint(label=key, sessions=sessions_count, seconds=seconds_count)
        for key, (sessions_count, seconds_count) in trend_map.items()
    ]

    type_counts = Counter((str(row.session_type) or "Beat Making") for row in completed)
    breakdown = [
        SessionStatsTypeBreakdownItem(
            session_type=session_type,
            sessions=count,
            percent=(count / total_sessions * 100) if total_sessions else 0.0,
        )
        for session_type, count in type_counts.items()
    ]
    breakdown.sort(key=lambda item: item.sessions, reverse=True)

    return SessionStatsPublic(
        period=period,
        summary=SessionStatsSummary(
            total_seconds=total_seconds,
            total_sessions=total_sessions,
            best_streak_days=best_streak,
            avg_session_seconds=avg_session_seconds,
        ),
        trend=trend,
        breakdown=breakdown,
    )
