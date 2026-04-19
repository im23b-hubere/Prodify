import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import RefreshToken, Streak, User, utcnow


def _expires_at_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
from app.rate_limit import limiter
from app.schemas import RefreshRequest, TokenPair, UserCreate, UserLogin, UserPublic
from app.security import create_access_token, hash_password, hash_refresh_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
_log = logging.getLogger(__name__)


def issue_tokens_for_user(db: Session, user: User, *, replace_all: bool) -> TokenPair:
    if replace_all:
        db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    access = create_access_token(str(user.id))
    raw_refresh = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=utcnow() + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    db.commit()
    return TokenPair(access_token=access, refresh_token=raw_refresh)


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.rate_limit_auth_register)
def register(request: Request, payload: UserCreate, db: Annotated[Session, Depends(get_db)]):
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    db.add(Streak(user_id=user.id, current_streak=0, longest_streak=0))
    db.commit()
    db.refresh(user)

    return issue_tokens_for_user(db, user, replace_all=True)


@router.post("/login", response_model=TokenPair)
@limiter.limit(settings.rate_limit_auth_login)
def login(request: Request, payload: UserLogin, db: Annotated[Session, Depends(get_db)]):
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.hashed_password):
        _log.warning("auth_login_failed")
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return issue_tokens_for_user(db, user, replace_all=True)


@router.post("/refresh", response_model=TokenPair)
@limiter.limit("30/minute")
def refresh_tokens(
    request: Request,
    payload: RefreshRequest,
    db: Annotated[Session, Depends(get_db)],
):
    th = hash_refresh_token(payload.refresh_token.strip())
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == th))
    now = utcnow()
    if row is None or _expires_at_utc(row.expires_at) < now:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user = db.get(User, row.user_id)
    if user is None:
        db.delete(row)
        db.commit()
        raise HTTPException(status_code=401, detail="User not found")
    db.delete(row)
    db.flush()
    return issue_tokens_for_user(db, user, replace_all=False)


@router.post("/logout")
def logout(current: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]):
    db.execute(delete(RefreshToken).where(RefreshToken.user_id == current.id))
    db.commit()
    return {"ok": True}


@router.get("/me", response_model=UserPublic)
def me(current: Annotated[User, Depends(get_current_user)]):
    return current
