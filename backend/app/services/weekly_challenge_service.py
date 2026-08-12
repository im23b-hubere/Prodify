from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts.social import (
    ChallengeEntryPublic,
    ChallengeLeaderboardPublic,
    PublicGoalPublic,
    WeeklyCheckinPublic,
)
from app.models import ChallengeParticipant, PublicGoal, WeeklyChallenge, WeeklyCheckin, utcnow
from app.services.kpi_tracker import track_event


class ChallengeNotFoundError(LookupError):
    pass


class ActiveWeeklyChallengeNotFoundError(LookupError):
    pass


def set_public_goal(
    db: Session,
    user_id: int,
    target_sessions: int,
    is_public: bool,
) -> PublicGoalPublic:
    week_start = _week_start_key()
    goal = db.scalar(
        select(PublicGoal).where(
            PublicGoal.user_id == user_id,
            PublicGoal.week_start == week_start,
        )
    )
    if goal is None:
        goal = PublicGoal(user_id=user_id, week_start=week_start)
        db.add(goal)
    goal.target_sessions = target_sessions
    goal.is_public = int(is_public)
    db.commit()
    return PublicGoalPublic(
        week_start=week_start,
        target_sessions=goal.target_sessions,
        is_public=bool(goal.is_public),
    )


def submit_weekly_checkin(
    db: Session,
    user_id: int,
    did_ship: bool,
    shipped_note: str | None,
) -> WeeklyCheckinPublic:
    week_start = _week_start_key()
    checkin = db.scalar(
        select(WeeklyCheckin).where(
            WeeklyCheckin.user_id == user_id,
            WeeklyCheckin.week_start == week_start,
        )
    )
    if checkin is None:
        checkin = WeeklyCheckin(user_id=user_id, week_start=week_start)
        db.add(checkin)
    checkin.did_ship = int(did_ship)
    checkin.shipped_note = shipped_note
    track_event(
        db,
        "challenge_checkin_submitted",
        user_id,
        {"did_ship": bool(checkin.did_ship)},
    )
    db.commit()
    return WeeklyCheckinPublic(
        week_start=week_start,
        did_ship=bool(checkin.did_ship),
        shipped_note=checkin.shipped_note,
    )


def join_weekly_challenge(
    db: Session,
    user_id: int,
    challenge_id: int,
) -> ChallengeLeaderboardPublic:
    challenge = db.get(WeeklyChallenge, challenge_id)
    if challenge is None:
        raise ChallengeNotFoundError
    participant = db.scalar(
        select(ChallengeParticipant).where(
            ChallengeParticipant.challenge_id == challenge.id,
            ChallengeParticipant.user_id == user_id,
        )
    )
    if participant is None:
        db.add(ChallengeParticipant(challenge_id=challenge.id, user_id=user_id, score=0))
    track_event(db, "challenge_joined", user_id, {"challenge_id": challenge.id})
    db.commit()
    return weekly_leaderboard(db)


def weekly_leaderboard(db: Session) -> ChallengeLeaderboardPublic:
    challenge = db.scalar(
        select(WeeklyChallenge).where(
            WeeklyChallenge.week_start == _week_start_key(),
            WeeklyChallenge.status == "active",
        )
    )
    if challenge is None:
        raise ActiveWeeklyChallengeNotFoundError
    participants = db.scalars(
        select(ChallengeParticipant)
        .where(ChallengeParticipant.challenge_id == challenge.id)
        .order_by(ChallengeParticipant.score.desc())
        .limit(100)
    ).all()
    return ChallengeLeaderboardPublic(
        challenge_id=challenge.id,
        week_start=challenge.week_start,
        entries=[
            ChallengeEntryPublic(user_id=participant.user_id, score=participant.score)
            for participant in participants
        ],
    )


def _week_start_key() -> str:
    today = utcnow().date()
    return (today - timedelta(days=today.weekday())).isoformat()
