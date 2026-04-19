import json
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ChallengeParticipant, PublicGoal, User, WeeklyChallenge, WeeklyCheckin, utcnow
from app.schemas import (
    ChallengeJoinBody,
    ChallengeLeaderboardPublic,
    ChallengeEntryPublic,
    PublicGoalBody,
    PublicGoalPublic,
    WeeklyCheckinBody,
    WeeklyCheckinPublic,
)
from app.services.kpi_tracker import track_event

router = APIRouter(prefix="/challenges", tags=["challenges"])


def _week_start_key() -> str:
    d = utcnow().date()
    return (d - timedelta(days=d.weekday())).isoformat()


def _active_challenge(db: Session) -> WeeklyChallenge:
    wk = _week_start_key()
    row = db.scalar(select(WeeklyChallenge).where(WeeklyChallenge.week_start == wk, WeeklyChallenge.status == "active"))
    if row is None:
        row = WeeklyChallenge(week_start=wk, challenge_type="weekly_sessions", status="active", config_json=json.dumps({}))
        db.add(row)
        db.flush()
    return row


@router.post("/public-goal", response_model=PublicGoalPublic)
def set_public_goal(
    body: PublicGoalBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    wk = _week_start_key()
    row = db.scalar(select(PublicGoal).where(PublicGoal.user_id == current.id, PublicGoal.week_start == wk))
    if row is None:
        row = PublicGoal(user_id=current.id, week_start=wk)
        db.add(row)
    row.target_sessions = body.target_sessions
    row.is_public = 1 if body.is_public else 0
    db.commit()
    return PublicGoalPublic(week_start=wk, target_sessions=row.target_sessions, is_public=bool(row.is_public))


@router.post("/checkin", response_model=WeeklyCheckinPublic)
def did_you_ship_checkin(
    body: WeeklyCheckinBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    wk = _week_start_key()
    row = db.scalar(select(WeeklyCheckin).where(WeeklyCheckin.user_id == current.id, WeeklyCheckin.week_start == wk))
    if row is None:
        row = WeeklyCheckin(user_id=current.id, week_start=wk)
        db.add(row)
    row.did_ship = 1 if body.did_ship else 0
    row.shipped_note = body.shipped_note
    track_event(db, "challenge_checkin_submitted", current.id, {"did_ship": bool(row.did_ship)})
    db.commit()
    return WeeklyCheckinPublic(week_start=wk, did_ship=bool(row.did_ship), shipped_note=row.shipped_note)


@router.post("/join", response_model=ChallengeLeaderboardPublic)
def join_weekly_challenge(
    body: ChallengeJoinBody,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    ch = db.get(WeeklyChallenge, body.challenge_id)
    if ch is None:
        raise HTTPException(status_code=404, detail="Challenge not found")
    row = db.scalar(
        select(ChallengeParticipant).where(
            ChallengeParticipant.challenge_id == ch.id,
            ChallengeParticipant.user_id == current.id,
        )
    )
    if row is None:
        row = ChallengeParticipant(challenge_id=ch.id, user_id=current.id, score=0)
        db.add(row)
    track_event(db, "challenge_joined", current.id, {"challenge_id": ch.id})
    db.commit()
    return weekly_leaderboard(current, db)


@router.get("/weekly/leaderboard", response_model=ChallengeLeaderboardPublic)
def weekly_leaderboard(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    ch = _active_challenge(db)
    rows = db.scalars(
        select(ChallengeParticipant)
        .where(ChallengeParticipant.challenge_id == ch.id)
        .order_by(ChallengeParticipant.score.desc())
        .limit(100)
    ).all()
    db.commit()
    return ChallengeLeaderboardPublic(
        challenge_id=ch.id,
        week_start=ch.week_start,
        entries=[ChallengeEntryPublic(user_id=row.user_id, score=row.score) for row in rows],
    )
