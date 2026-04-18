import json
from collections import Counter, defaultdict
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ProductionSession, SessionType, Streak, User, utcnow
from app.streakutil import best_streak_run, compute_current_streak, parse_frozen_json
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


def _accumulate_pause_if_needed(row: ProductionSession, end_time) -> None:
    if row.pause_started_at is None:
        return
    delta = int((end_time - as_utc_aware(row.pause_started_at)).total_seconds())
    if delta > 0:
        row.paused_duration_seconds = (row.paused_duration_seconds or 0) + delta
    row.pause_started_at = None


def _productivity_hint(rows: list[ProductionSession]) -> str | None:
    if len(rows) < 10:
        return None
    by_dow: Counter[int] = Counter()
    by_hour: Counter[int] = Counter()
    for row in rows:
        if row.duration_seconds is None:
            continue
        dt = as_utc_aware(row.started_at)
        by_dow[dt.weekday()] += 1
        by_hour[dt.hour] += 1
    top_dow = by_dow.most_common(1)[0][0]
    top_hour = by_hour.most_common(1)[0][0]
    names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    return f"You're most productive on {names[top_dow]} around {top_hour}:00–{(top_hour + 3) % 24}:00 (UTC)."


@router.post("/start", response_model=SessionPublic, status_code=status.HTTP_201_CREATED)
def start_session(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    body: SessionStart,
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

    tags_str = json.dumps(body.tags) if body.tags else None
    row = ProductionSession(
        user_id=current.id,
        started_at=utcnow(),
        notes=body.notes,
        session_type=body.session_type.value,
        mood_level=body.mood_level,
        tags=tags_str,
        paused_duration_seconds=0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/active", response_model=SessionPublic)
def get_active_session(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.scalar(
        select(ProductionSession).where(
            ProductionSession.user_id == current.id,
            ProductionSession.stopped_at.is_(None),
            ProductionSession.deleted_at.is_(None),
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="No active session")
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
    _accumulate_pause_if_needed(row, end)
    gross = int((end - as_utc_aware(row.started_at)).total_seconds())
    paused = row.paused_duration_seconds or 0
    row.stopped_at = end
    row.duration_seconds = max(0, gross - paused)
    db.commit()
    db.refresh(row)
    return row


@router.post("/item/{session_id}/pause", response_model=SessionPublic)
def pause_session(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(ProductionSession, session_id)
    if row is None or row.user_id != current.id or row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Session not found")
    if row.stopped_at is not None:
        raise HTTPException(status_code=400, detail="Session already stopped")
    if row.pause_started_at is not None:
        raise HTTPException(status_code=400, detail="Session is already paused")
    row.pause_started_at = utcnow()
    db.commit()
    db.refresh(row)
    return row


@router.post("/item/{session_id}/resume", response_model=SessionPublic)
def resume_session(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(ProductionSession, session_id)
    if row is None or row.user_id != current.id or row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Session not found")
    if row.stopped_at is not None:
        raise HTTPException(status_code=400, detail="Session already stopped")
    if row.pause_started_at is None:
        raise HTTPException(status_code=400, detail="Session is not paused")
    now = utcnow()
    delta = int((now - as_utc_aware(row.pause_started_at)).total_seconds())
    if delta > 0:
        row.paused_duration_seconds = (row.paused_duration_seconds or 0) + delta
    row.pause_started_at = None
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
    if "mood_level" in updates:
        row.mood_level = updates["mood_level"]
    if "tags" in updates:
        row.tags = json.dumps(updates["tags"]) if updates["tags"] else None

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
    period_label = period
    if period in ("7d", "week"):
        period_label = "week"
        period_days = 7
    elif period in ("30d", "month"):
        period_label = "month"
        period_days = 30
    elif period == "all":
        period_label = "all"
        period_days = None
    else:
        period_label = "week"
        period_days = 7

    since = now - timedelta(days=period_days) if period_days is not None else None

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

    all_for_streak = db.scalars(
        select(ProductionSession)
        .where(
            ProductionSession.user_id == current.id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
        .order_by(ProductionSession.started_at.asc())
    ).all()
    streak_days = [as_utc_aware(r.started_at).date().isoformat() for r in all_for_streak]
    streak_row = db.scalar(select(Streak).where(Streak.user_id == current.id))
    frozen_keys = parse_frozen_json(streak_row.frozen_day_keys) if streak_row else []
    merged = list(set(streak_days) | set(frozen_keys))
    current_streak = compute_current_streak(merged)
    best_streak = best_streak_run(merged)

    hours_delta: float | None = None
    if since is not None and period_days is not None:
        prior_start = since - timedelta(days=period_days)
        prior_rows = db.scalars(
            select(ProductionSession).where(
                ProductionSession.user_id == current.id,
                ProductionSession.deleted_at.is_(None),
                ProductionSession.started_at >= prior_start,
                ProductionSession.started_at < since,
                ProductionSession.duration_seconds.is_not(None),
            )
        ).all()
        prior_seconds = int(sum((r.duration_seconds or 0) for r in prior_rows))
        hours_delta = round((total_seconds - prior_seconds) / 3600, 1)

    trend_map: dict[str, tuple[int, int]] = {}
    for row in completed:
        key = as_utc_aware(row.started_at).date().isoformat()
        sessions_count, seconds_count = trend_map.get(key, (0, 0))
        trend_map[key] = (sessions_count + 1, seconds_count + int(row.duration_seconds or 0))
    trend = [
        SessionStatsTrendPoint(label=key, sessions=sessions_count, seconds=seconds_count)
        for key, (sessions_count, seconds_count) in sorted(trend_map.items())
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

    recent = sorted(
        completed,
        key=lambda r: as_utc_aware(r.started_at),
        reverse=True,
    )[:10]

    hint = _productivity_hint(completed)

    return SessionStatsPublic(
        period=period_label,
        summary=SessionStatsSummary(
            total_seconds=total_seconds,
            total_sessions=total_sessions,
            best_streak_days=best_streak,
            avg_session_seconds=avg_session_seconds,
            current_streak_days=current_streak,
            hours_delta_vs_prior_period=hours_delta,
        ),
        trend=trend,
        breakdown=breakdown,
        recent_sessions=[SessionPublic.model_validate(r) for r in recent],
        productivity_hint=hint,
    )
