import json
import logging
from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.achievementsutil import (
    compute_focus_score_for_session,
    grant_achievements_after_completed_session,
    session_focus_metrics,
)
from app.models import CheckinLog, Friendship, FriendshipStatus, ProductionSession, SessionType, Streak, User, UserGoal, utcnow
from app.services.push_dispatch import schedule_notify_session_complete
from app.services.social_consequence import maybe_notify_streak_break_on_transition
from app.services.streak_reconcile_service import reconcile_streak_row_for_user
from app.services.kpi_tracker import track_event
from app.services.progression_service import grant_xp, xp_for_completed_session
from app.streakutil import best_streak_run, compute_current_streak, parse_frozen_json
from app.timeutil import as_utc_aware
from app.schemas import (
    InsightItemPublic,
    RelatedSessionPublic,
    SessionDetailInsightsPublic,
    SessionPublic,
    SessionQuickStart,
    SessionStart,
    SessionStatsPublic,
    SessionStatsSummary,
    SessionStatsTrendPoint,
    SessionStatsTypeBreakdownItem,
    SessionStop,
    SessionTimelineSegmentPublic,
    SessionUpdate,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])
_log = logging.getLogger(__name__)

# Applied only in /sessions/stats aggregates; raw `duration_seconds` on each session row is unchanged.
_STATS_DURATION_CAP_SECONDS = 48 * 3600


def _duration_for_stats_seconds(sec: int | None) -> int:
    return min(int(sec or 0), _STATS_DURATION_CAP_SECONDS)

def _mark_auto_checkin_done(db: Session, user_id: int) -> None:
    """Automatically reflect session activity in social check-in status."""
    day_key = utcnow().date().isoformat()
    row = db.scalar(select(CheckinLog).where(CheckinLog.user_id == user_id, CheckinLog.day_key == day_key))
    if row is None:
        row = CheckinLog(user_id=user_id, day_key=day_key, state="done", note="Auto session activity")
        db.add(row)
    else:
        row.state = "done"
        if not row.note:
            row.note = "Auto session activity"


def _friend_user_ids(db: Session, user_id: int) -> list[int]:
    """Same logic as friends activity feed — use this for 'can view friend session' checks."""
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


def _can_view_session(db: Session, viewer_id: int, row: ProductionSession) -> bool:
    if row.user_id == viewer_id:
        return True
    if row.deleted_at is not None:
        return False
    if row.stopped_at is None or row.duration_seconds is None:
        return False
    return row.user_id in _friend_user_ids(db, viewer_id)


def _accumulate_pause_if_needed(row: ProductionSession, end_time) -> None:
    if row.pause_started_at is None:
        return
    delta = int((end_time - as_utc_aware(row.pause_started_at)).total_seconds())
    if delta > 0:
        row.paused_duration_seconds = (row.paused_duration_seconds or 0) + delta
    row.pause_started_at = None


def _productivity_hint_item(rows: list[ProductionSession]) -> InsightItemPublic | None:
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
    return InsightItemPublic(
        key="prod_peak_pattern",
        params={"weekday": top_dow, "hour": top_hour},
    )


@router.post("/start", response_model=SessionPublic, status_code=status.HTTP_201_CREATED)
def start_session(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    body: SessionStart,
):
    try:
        _log.debug("session_start_attempt user_id=%s session_type=%s", current.id, body.session_type.value)
        active = db.scalar(
            select(ProductionSession).where(
                ProductionSession.user_id == current.id,
                ProductionSession.stopped_at.is_(None),
                ProductionSession.deleted_at.is_(None),
            )
        )
        if active is not None:
            _log.warning("session_start_conflict user_id=%s existing_session_id=%s", current.id, active.id)
            raise HTTPException(
                status_code=409,
                detail={"message": "Active session already exists", "session_id": active.id},
            )

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
        _mark_auto_checkin_done(db, current.id)
        db.commit()
        db.refresh(row)
        track_event(db, "session_started", current.id, {"session_id": row.id, "session_type": row.session_type})
        db.commit()
        _log.info("session_started user_id=%s session_id=%s", current.id, row.id)
        return row
    except IntegrityError as exc:
        _log.error("IntegrityError: %s", str(exc))
        db.rollback()
        existing = db.scalar(
            select(ProductionSession).where(
                ProductionSession.user_id == current.id,
                ProductionSession.stopped_at.is_(None),
                ProductionSession.deleted_at.is_(None),
            )
        )
        raise HTTPException(
            status_code=409,
            detail={"message": "Active session already exists", "session_id": existing.id if existing else None},
        )
    except HTTPException:
        raise
    except Exception as exc:
        _log.error("UNEXPECTED ERROR: %s", type(exc).__name__)
        _log.error("Error message: %s", str(exc))
        _log.error("Traceback:", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred. Please try again.",
        )


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
        _log.warning("session_stop_not_found session_id=%s user_id=%s", body.session_id, current.id)
        raise HTTPException(status_code=404, detail="Session not found")
    if row.stopped_at is not None:
        _log.warning("session_stop_already_stopped session_id=%s user_id=%s", body.session_id, current.id)
        raise HTTPException(status_code=400, detail="Session already stopped")

    end = utcnow()
    _accumulate_pause_if_needed(row, end)
    gross = int((end - as_utc_aware(row.started_at)).total_seconds())
    paused = row.paused_duration_seconds or 0
    row.stopped_at = end
    row.duration_seconds = max(0, gross - paused)
    row.focus_score = compute_focus_score_for_session(row)
    _mark_auto_checkin_done(db, current.id)
    db.flush()
    xp_delta = xp_for_completed_session(int(row.duration_seconds or 0))
    grant_xp(
        db,
        current.id,
        xp_delta,
        source_type="session_complete",
        source_id=str(row.id),
        meta={"duration_seconds": int(row.duration_seconds or 0), "focus_score": int(row.focus_score or 0)},
    )
    track_event(
        db,
        "session_completed",
        current.id,
        {"session_id": row.id, "duration_seconds": int(row.duration_seconds or 0), "xp_delta": xp_delta},
    )
    streak_row = db.scalar(select(Streak).where(Streak.user_id == current.id))
    grant_achievements_after_completed_session(db, current.id, row, streak_row)
    _, prev_streak, new_streak, _, _ = reconcile_streak_row_for_user(db, current.id)
    db.commit()
    db.refresh(row)
    maybe_notify_streak_break_on_transition(prev_streak, new_streak, current.id)
    try:
        schedule_notify_session_complete(
            settings,
            current.id,
            str(row.session_type),
            int(row.duration_seconds or 0),
        )
    except Exception:
        _log.exception("schedule session-complete push failed")
    _log.info("session_stopped user_id=%s session_id=%s duration_s=%s", current.id, row.id, row.duration_seconds)
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


@router.post("/quick-start", response_model=SessionPublic, status_code=status.HTTP_201_CREATED)
def quick_start_session(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    body: SessionQuickStart = SessionQuickStart(),
):
    active = db.scalar(
        select(ProductionSession).where(
            ProductionSession.user_id == current.id,
            ProductionSession.stopped_at.is_(None),
            ProductionSession.deleted_at.is_(None),
        )
    )
    if active is not None:
        raise HTTPException(
            status_code=409,
            detail={"message": "Active session already exists", "session_id": active.id},
        )

    st = body.session_type.value
    row = ProductionSession(
        user_id=current.id,
        started_at=utcnow(),
        session_type=st,
        paused_duration_seconds=0,
    )
    db.add(row)
    _mark_auto_checkin_done(db, current.id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(
            select(ProductionSession).where(
                ProductionSession.user_id == current.id,
                ProductionSession.stopped_at.is_(None),
                ProductionSession.deleted_at.is_(None),
            )
        )
        raise HTTPException(
            status_code=409,
            detail={"message": "Active session already exists", "session_id": existing.id if existing else None},
        )
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
    if row is None or not _can_view_session(db, current.id, row):
        raise HTTPException(status_code=404, detail="Session not found")
    return row


def _monday_week_start(d: date) -> str:
    return (d - timedelta(days=d.weekday())).isoformat()


@router.get("/item/{session_id}/insights", response_model=SessionDetailInsightsPublic)
def session_detail_insights(
    session_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    row = db.get(ProductionSession, session_id)
    if row is None or row.user_id != current.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if row.stopped_at is None or row.duration_seconds is None:
        raise HTTPException(status_code=400, detail="Session must be completed")

    focus_score, rate = session_focus_metrics(row)
    dur = int(row.duration_seconds or 0)
    paused = int(row.paused_duration_seconds or 0)

    peer_rows = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == current.id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.id != row.id,
        )
    ).all()
    peer_scores = [session_focus_metrics(r)[0] for r in peer_rows]
    percentile: int | None = None
    focus_user_average: int | None = None
    if peer_scores:
        below = sum(1 for s in peer_scores if s < focus_score)
        percentile = int(round(100 * below / len(peer_scores)))
        focus_user_average = int(round(sum(peer_scores) / len(peer_scores)))

    if focus_score >= 95:
        focus_tier = "excellent"
    elif focus_score >= 80:
        focus_tier = "strong"
    elif focus_score >= 60:
        focus_tier = "solid"
    else:
        focus_tier = "room_to_improve"

    impact_items: list[InsightItemPublic] = []
    all_completed = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == current.id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()
    session_days = [as_utc_aware(r.started_at).date().isoformat() for r in all_completed]
    streak_row = db.scalar(select(Streak).where(Streak.user_id == current.id))
    frozen = parse_frozen_json(streak_row.frozen_day_keys) if streak_row else []
    merged = list(set(session_days) | set(frozen))
    cur_streak = compute_current_streak(merged)
    sess_day = as_utc_aware(row.started_at).date().isoformat()
    if cur_streak > 0 and sess_day == utcnow().date().isoformat():
        impact_items.append(InsightItemPublic(key="impact_streak_fuel", params={"days": cur_streak}))

    sess_week = _monday_week_start(as_utc_aware(row.started_at).date())
    goal = db.scalar(
        select(UserGoal).where(
            UserGoal.user_id == current.id,
            UserGoal.goal_type == "weekly_sessions",
            UserGoal.week_start == sess_week,
        )
    )
    if goal:
        same_week = [r for r in all_completed if _monday_week_start(as_utc_aware(r.started_at).date()) == sess_week]
        cnt = len(same_week)
        if goal.target_value > 0 and cnt >= goal.target_value:
            impact_items.append(
                InsightItemPublic(
                    key="impact_weekly_goal_cleared",
                    params={"count": cnt, "target": goal.target_value},
                )
            )
        elif goal.target_value > 0:
            impact_items.append(
                InsightItemPublic(
                    key="impact_week_progress",
                    params={"count": cnt, "target": goal.target_value},
                )
            )

    if not impact_items:
        impact_items.append(InsightItemPublic(key="impact_default_momentum", params={}))

    productivity_items: list[InsightItemPublic] = []
    hint_item = _productivity_hint_item(all_completed)
    if hint_item:
        productivity_items.append(hint_item)
    if paused <= 60:
        productivity_items.append(InsightItemPublic(key="prod_minimal_pause", params={}))
    elif paused > 600:
        productivity_items.append(InsightItemPublic(key="prod_long_breaks", params={}))

    timeline: list[SessionTimelineSegmentPublic] = []
    if dur > 0:
        timeline.append(SessionTimelineSegmentPublic(kind="active", seconds=dur))
    if paused > 0:
        timeline.append(SessionTimelineSegmentPublic(kind="paused", seconds=paused))

    related = db.scalars(
        select(ProductionSession)
        .where(
            ProductionSession.user_id == current.id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.session_type == row.session_type,
            ProductionSession.id != row.id,
        )
        .order_by(ProductionSession.started_at.desc())
        .limit(4)
    ).all()

    return SessionDetailInsightsPublic(
        impact_lines=[],
        impact_items=impact_items,
        focus_score=focus_score,
        focus_label="",
        focus_tier=focus_tier,
        focus_percentile=percentile,
        focus_user_average=focus_user_average,
        active_seconds=dur,
        paused_seconds=paused,
        effective_rate_percent=rate,
        timeline=timeline,
        productivity_insights=[],
        productivity_items=productivity_items,
        related_sessions=[
            RelatedSessionPublic(
                id=r.id,
                session_type=r.session_type,
                duration_seconds=r.duration_seconds,
                started_at=r.started_at,
            )
            for r in related
        ],
    )


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
    if "track_outcome" in updates:
        row.track_outcome = updates["track_outcome"]
        if updates["track_outcome"] != "finished":
            row.track_title = None
    if "track_title" in updates:
        effective_outcome = row.track_outcome or "none"
        row.track_title = updates["track_title"] if effective_outcome == "finished" else None

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
    if row.stopped_at is None:
        raise HTTPException(status_code=409, detail="Active sessions cannot be deleted")
    row.deleted_at = utcnow()
    reconcile_streak_row_for_user(db, current.id)
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
    if row.stopped_at is None:
        active = db.scalar(
            select(ProductionSession).where(
                ProductionSession.user_id == current.id,
                ProductionSession.stopped_at.is_(None),
                ProductionSession.deleted_at.is_(None),
            )
        )
        if active is not None and active.id != row.id:
            raise HTTPException(
                status_code=409,
                detail={"message": "Active session already exists", "session_id": active.id},
            )
    row.deleted_at = None
    reconcile_streak_row_for_user(db, current.id)
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
    total_seconds = int(sum(_duration_for_stats_seconds(row.duration_seconds) for row in completed))
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
        prior_seconds = int(sum(_duration_for_stats_seconds(r.duration_seconds) for r in prior_rows))
        hours_delta = round((total_seconds - prior_seconds) / 3600, 1)

    trend_map: dict[str, tuple[int, int]] = {}
    for row in completed:
        key = as_utc_aware(row.started_at).date().isoformat()
        sessions_count, seconds_count = trend_map.get(key, (0, 0))
        trend_map[key] = (
            sessions_count + 1,
            seconds_count + _duration_for_stats_seconds(row.duration_seconds),
        )
    trend = [
        SessionStatsTrendPoint(label=key, sessions=sessions_count, seconds=seconds_count)
        for key, (sessions_count, seconds_count) in sorted(trend_map.items())
    ]

    type_counts = Counter((str(row.session_type) or "beat_making") for row in completed)
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

    hint_item = _productivity_hint_item(completed)

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
        productivity_hint=None,
        productivity_hint_item=hint_item,
    )
