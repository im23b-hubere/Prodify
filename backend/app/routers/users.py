"""Public friend profiles: stats, heatmap, and recent sessions (friends-only)."""

from __future__ import annotations

import secrets
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, time, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    Friendship,
    FriendshipStatus,
    ProductionSession,
    SocialChallengeMember,
    Streak,
    User,
    UserAchievement,
    utcnow,
)
from app.schemas import (
    AchievementUnlockedPublic,
    HeatmapDayPublic,
    UserFriendProfilePublic,
    UserFriendStatsPublic,
    UserPublic,
    UserPublicSessionItem,
)
from app.timeutil import as_utc_aware

router = APIRouter(prefix="/users", tags=["users"])
PROFILE_UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "profile_pictures"
PROFILE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """Permanently delete the authenticated account and associated data (DSGVO / right to erasure)."""
    db.delete(current)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _accepted_friendship(db: Session, a: int, b: int) -> bool:
    if a == b:
        return True
    row = db.scalar(
        select(Friendship).where(
            Friendship.status == FriendshipStatus.accepted,
            or_(
                (Friendship.user_id == a) & (Friendship.friend_id == b),
                (Friendship.user_id == b) & (Friendship.friend_id == a),
            ),
        )
    )
    return row is not None


def _friends_count(db: Session, user_id: int) -> int:
    rows = db.scalars(
        select(Friendship).where(
            Friendship.status == FriendshipStatus.accepted,
            or_(Friendship.user_id == user_id, Friendship.friend_id == user_id),
        )
    ).all()
    return len(rows)


def _heatmap_days(db: Session, user_id: int) -> list[HeatmapDayPublic]:
    today = utcnow().date()
    start = today - timedelta(days=89)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)

    rows = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
            ProductionSession.started_at >= start_dt,
        )
    ).all()

    by_day: defaultdict[str, int] = defaultdict(int)
    for r in rows:
        k = as_utc_aware(r.started_at).date().isoformat()
        by_day[k] += int(r.duration_seconds or 0)

    out: list[HeatmapDayPublic] = []
    for i in range(90):
        d = start + timedelta(days=i)
        ds = d.isoformat()
        sec = by_day.get(ds, 0)
        if sec <= 0:
            lvl = 0
        elif sec < 1800:
            lvl = 1
        elif sec < 7200:
            lvl = 2
        elif sec < 18000:
            lvl = 3
        else:
            lvl = 4
        out.append(HeatmapDayPublic(date=ds, seconds=sec, intensity=lvl))
    return out


def _require_friend_profile(db: Session, current: User, target_id: int) -> User:
    target = db.get(User, target_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not _accepted_friendship(db, current.id, target_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not friends with this user")
    return target


def _detect_image_mime(content: bytes) -> str | None:
    if len(content) >= 8 and content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(content) >= 3 and content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def _identity_tags_for_profile(db: Session, user_id: int) -> list[str]:
    wk = (utcnow().date() - timedelta(days=utcnow().date().weekday())).isoformat()
    sessions_week = len(
        db.scalars(
            select(ProductionSession).where(
                ProductionSession.user_id == user_id,
                ProductionSession.deleted_at.is_(None),
                ProductionSession.duration_seconds.is_not(None),
                ProductionSession.started_at >= datetime.combine(
                    datetime.fromisoformat(wk).date(), time.min, tzinfo=timezone.utc
                ),
            )
        ).all()
    )
    tags: list[str] = []
    if sessions_week >= 4:
        tags.append("consistent_creator")
    challenge_rows = db.scalars(select(SocialChallengeMember).where(SocialChallengeMember.user_id == user_id)).all()
    if challenge_rows:
        tags.append("competitive")
    if sessions_week >= 6:
        tags.append("locked_in")
    return tags[:2] if tags else ["creator"]


@router.post("/me/profile-picture", response_model=UserPublic)
async def upload_profile_picture(
    request: Request,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    declared_content_type = (file.content_type or "").lower().strip()
    if not declared_content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image uploads are allowed")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded image is empty")
    if len(content) > MAX_PROFILE_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image exceeds 5MB limit")

    detected_mime = _detect_image_mime(content)
    if detected_mime not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image format")

    ext = MIME_TO_EXT[detected_mime]

    filename = f"{current.id}-{secrets.token_hex(8)}{ext}"
    target = PROFILE_UPLOAD_DIR / filename
    target.write_bytes(content)

    old_url = current.profile_picture_url
    current.profile_picture_url = f"/uploads/profile_pictures/{filename}"
    db.add(current)
    db.commit()
    db.refresh(current)

    if old_url and old_url.startswith("/uploads/profile_pictures/"):
        old_name = old_url.split("/uploads/profile_pictures/", 1)[1]
        old_path = PROFILE_UPLOAD_DIR / old_name
        if old_path.exists():
            old_path.unlink(missing_ok=True)

    # Return absolute URL to avoid client-side URL joining bugs.
    base = str(request.base_url).rstrip("/")
    absolute_url = f"{base}{current.profile_picture_url}" if current.profile_picture_url else None
    return UserPublic(
        id=current.id,
        email=current.email,
        username=current.username,
        profile_picture_url=absolute_url,
        is_premium=bool(int(current.is_premium or 0)),
        created_at=current.created_at,
    )


@router.get("/{user_id}/profile", response_model=UserFriendProfilePublic)
def get_user_profile(
    user_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    user = _require_friend_profile(db, current, user_id)

    completed = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()
    total_sessions = len(completed)

    streak_row = db.scalar(select(Streak).where(Streak.user_id == user_id))
    cur = int(streak_row.current_streak or 0) if streak_row else 0
    longest = int(streak_row.longest_streak or 0) if streak_row else 0

    return UserFriendProfilePublic(
        id=user.id,
        username=user.username,
        profile_picture_url=user.profile_picture_url,
        total_sessions=total_sessions,
        current_streak=cur,
        longest_streak=longest,
        friends_count=_friends_count(db, user_id),
        is_premium=bool(int(user.is_premium or 0)),
        identity_tags=_identity_tags_for_profile(db, user_id),
        created_at=user.created_at,
    )


@router.get("/{user_id}/stats", response_model=UserFriendStatsPublic)
def get_user_stats(
    user_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _require_friend_profile(db, current, user_id)

    sessions = db.scalars(
        select(ProductionSession).where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.duration_seconds.is_not(None),
        )
    ).all()

    total_sessions = len(sessions)
    total_minutes = sum(int(s.duration_seconds or 0) for s in sessions) / 60.0

    type_counts: Counter[str] = Counter((s.session_type or "beat_making") for s in sessions)

    day_counts: Counter[str] = Counter()
    for s in sessions:
        day_counts[as_utc_aware(s.started_at).strftime("%A")] += 1
    best_day = max(day_counts.items(), key=lambda x: x[1])[0] if day_counts else None

    streak_row = db.scalar(select(Streak).where(Streak.user_id == user_id))
    cur = int(streak_row.current_streak or 0) if streak_row else 0
    longest = int(streak_row.longest_streak or 0) if streak_row else 0

    ach_rows = db.scalars(select(UserAchievement).where(UserAchievement.user_id == user_id)).all()
    achievements = [AchievementUnlockedPublic(id=r.achievement_type, unlocked_at=r.unlocked_at) for r in ach_rows]

    return UserFriendStatsPublic(
        total_hours=round(total_minutes / 60.0, 1),
        total_sessions=total_sessions,
        current_streak=cur,
        longest_streak=longest,
        type_breakdown=dict(type_counts),
        best_day=best_day,
        heatmap_days=_heatmap_days(db, user_id),
        achievements=achievements,
    )


@router.get("/{user_id}/sessions", response_model=list[UserPublicSessionItem])
def get_user_sessions(
    user_id: int,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 10,
):
    _require_friend_profile(db, current, user_id)
    if limit < 1:
        limit = 1
    if limit > 50:
        limit = 50

    rows = db.scalars(
        select(ProductionSession)
        .where(
            ProductionSession.user_id == user_id,
            ProductionSession.deleted_at.is_(None),
            ProductionSession.stopped_at.is_not(None),
            ProductionSession.duration_seconds.is_not(None),
        )
        .order_by(ProductionSession.started_at.desc())
        .limit(limit)
    ).all()

    return [
        UserPublicSessionItem(
            id=r.id,
            session_type=r.session_type,
            duration_seconds=int(r.duration_seconds or 0),
            started_at=r.started_at,
            mood_level=r.mood_level,
        )
        for r in rows
    ]
