import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.contracts.auth import TokenPair
from app.models import RefreshToken, User, utcnow
from app.security import create_access_token, hash_refresh_token


class RefreshTokenRejected(Exception):
    """Raised when a refresh token cannot be safely rotated."""


def issue_tokens_for_user(db: Session, user: User, *, replace_all: bool) -> TokenPair:
    if replace_all:
        db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))

    access_token = create_access_token(
        str(user.id),
        token_version=int(user.access_token_version or 0),
    )
    raw_refresh_token = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh_token),
            expires_at=utcnow() + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    db.commit()
    return TokenPair(access_token=access_token, refresh_token=raw_refresh_token)


def rotate_refresh_token(db: Session, raw_refresh_token: str) -> TokenPair:
    token_hash = hash_refresh_token(raw_refresh_token.strip())
    stored_token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if stored_token is None or _as_utc(stored_token.expires_at) < utcnow():
        raise RefreshTokenRejected("Invalid or expired refresh token")

    user = db.get(User, stored_token.user_id)
    if user is None:
        db.delete(stored_token)
        db.commit()
        raise RefreshTokenRejected("User not found")

    db.delete(stored_token)
    db.flush()
    return issue_tokens_for_user(db, user, replace_all=False)


def revoke_user_tokens(db: Session, user: User) -> None:
    user.access_token_version = int(user.access_token_version or 0) + 1
    db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    db.commit()


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
