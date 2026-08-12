from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.dependencies_subscription import user_has_premium_access
from app.models import User
from app.contracts.social import (
    IdentityStatePublic,
    SocialLeaderboardContextEntry,
    SocialLeaderboardContextPublic,
    SocialWeeklyRecapPublic,
)
from app.services.buddy_service import get_buddy_status
from app.services.friend_graph import friend_user_ids
from app.services.identity_tags import social_identity_tags
from app.services.social_week_service import (
    current_week_start,
    previous_week_start,
    session_count,
    session_counts,
)


router = APIRouter()


@router.get("/weekly-recap", response_model=SocialWeeklyRecapPublic)
def get_weekly_recap(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    week_start = current_week_start()
    current_sessions = session_count(db, current.id, week_start)
    buddy = get_buddy_status(db, current.id)
    accepted_friend_ids = friend_user_ids(db, current.id)
    previous_sessions = session_count(db, current.id, previous_week_start())
    session_delta = current_sessions - previous_sessions
    identity_tags = social_identity_tags(db, current.id, week_start=week_start)
    premium = user_has_premium_access(db, current)
    return SocialWeeklyRecapPublic(
        week_start=week_start,
        your_sessions=current_sessions,
        buddy_sessions=buddy.buddy_week_sessions if buddy.status == "active" else 0,
        team_sessions=sum(session_counts(db, accepted_friend_ids, week_start).values()),
        wow_delta_sessions=session_delta,
        has_active_buddy=buddy.status == "active",
        identity_tag=identity_tags[0] if identity_tags else None,
        trend_vs_last_week_percent=(
            round((session_delta / previous_sessions) * 100, 1)
            if previous_sessions > 0 and premium
            else None
        ),
        premium_detail_locked=not premium,
        upsell_hint=(
            None
            if premium
            else "Unlock full social insights with Premium."
        ),
    )


@router.get("/leaderboard/context", response_model=SocialLeaderboardContextPublic)
def get_leaderboard_context(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    user_ids = [current.id, *friend_user_ids(db, current.id)]
    usernames = {
        user.id: user.username
        for user in db.scalars(select(User).where(User.id.in_(user_ids))).all()
    }
    current_counts = session_counts(db, user_ids, current_week_start())
    previous_counts = session_counts(db, user_ids, previous_week_start())
    ranked_users = sorted(user_ids, key=lambda user_id: current_counts.get(user_id, 0), reverse=True)
    entries = [
        _leaderboard_entry(
            user_id=user_id,
            username=usernames.get(user_id, "?"),
            rank=rank,
            current_sessions=current_counts.get(user_id, 0),
            previous_sessions=previous_counts.get(user_id, 0),
        )
        for rank, user_id in enumerate(ranked_users, start=1)
    ]
    current_user_rank = next((entry.rank for entry in entries if entry.user_id == current.id), None)
    return SocialLeaderboardContextPublic(
        entries=entries,
        chasing_user_id=_user_id_at_rank(entries, current_user_rank - 1 if current_user_rank else None),
        threatening_user_id=_user_id_at_rank(entries, current_user_rank + 1 if current_user_rank else None),
    )


@router.get("/identity", response_model=IdentityStatePublic)
def get_identity_state(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    tags = social_identity_tags(db, current.id, week_start=current_week_start())
    primary_tag = tags[0]
    identity_lines = {
        "creator": "You're shaping your sound.",
        "consistent_creator": "You've been consistently producing this week.",
        "collaborative": "You're keeping your producer circle active.",
        "competitive": "You're in a close creative battle - keep pushing.",
        "locked_in": "You're in a creative flow right now.",
        "building_momentum": "You're getting back into your flow.",
    }
    return IdentityStatePublic(
        primary_tag=primary_tag,
        secondary_tag=tags[1] if len(tags) > 1 else None,
        tags=tags,
        line=identity_lines.get(primary_tag, "You're building momentum."),
    )


def _leaderboard_entry(
    *,
    user_id: int,
    username: str,
    rank: int,
    current_sessions: int,
    previous_sessions: int,
) -> SocialLeaderboardContextEntry:
    movement = current_sessions - previous_sessions
    return SocialLeaderboardContextEntry(
        user_id=user_id,
        username=username,
        rank=rank,
        sessions=current_sessions,
        movement=movement,
        trend="up" if movement > 0 else "down" if movement < 0 else "flat",
    )


def _user_id_at_rank(entries: list[SocialLeaderboardContextEntry], rank: int | None) -> int | None:
    if rank is None:
        return None
    entry = next((candidate for candidate in entries if candidate.rank == rank), None)
    return entry.user_id if entry else None
