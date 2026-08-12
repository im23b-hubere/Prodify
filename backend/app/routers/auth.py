import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.contracts.auth import RefreshRequest, TokenPair, UserAccountPublic, UserCreate, UserLogin
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Streak, User
from app.rate_limit import limiter
from app.security import hash_password, verify_password
from app.services.auth_token_service import (
    RefreshTokenRejected,
    issue_tokens_for_user,
    revoke_user_tokens,
    rotate_refresh_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])
_log = logging.getLogger(__name__)


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.rate_limit_auth_register)
def register(request: Request, payload: UserCreate, db: Annotated[Session, Depends(get_db)]):
    normalized_email = str(payload.email).strip().lower()
    normalized_username = payload.username.strip().lower()

    if db.scalar(select(User).where(func.lower(User.email) == normalized_email)):
        raise HTTPException(status_code=400, detail="Unable to register with the provided credentials")
    if db.scalar(select(User).where(func.lower(User.username) == normalized_username)):
        raise HTTPException(status_code=400, detail="Unable to register with the provided credentials")

    user = User(
        email=normalized_email,
        username=normalized_username,
        hashed_password=hash_password(payload.password),
    )
    try:
        db.add(user)
        db.flush()
        db.add(Streak(user_id=user.id, current_streak=0, longest_streak=0))
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to register with the provided credentials") from None

    return issue_tokens_for_user(db, user, replace_all=True)


@router.post("/login", response_model=TokenPair)
@limiter.limit(settings.rate_limit_auth_login)
def login(request: Request, payload: UserLogin, db: Annotated[Session, Depends(get_db)]):
    normalized_email = str(payload.email).strip().lower()
    user = db.scalar(select(User).where(func.lower(User.email) == normalized_email))
    if user is None or not verify_password(payload.password, user.hashed_password):
        _log.warning("auth_login_failed")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return issue_tokens_for_user(db, user, replace_all=True)


@router.post("/refresh", response_model=TokenPair)
@limiter.limit("30/minute")
def refresh_tokens(
    request: Request,
    payload: RefreshRequest,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return rotate_refresh_token(db, payload.refresh_token)
    except RefreshTokenRejected as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/logout")
def logout(current: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]):
    revoke_user_tokens(db, current)
    return {"ok": True}


@router.get("/me", response_model=UserAccountPublic)
def me(current: Annotated[User, Depends(get_current_user)]):
    return current
