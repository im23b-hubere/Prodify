import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.contracts.auth import RefreshRequest, TokenPair, UserAccountPublic, UserCreate, UserLogin
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.rate_limit import limiter
from app.services.auth_account_service import (
    InvalidCredentialsError,
    RegistrationRejectedError,
    authenticate_account,
    register_account,
)
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
    try:
        user = register_account(
            db,
            str(payload.email),
            payload.username,
            payload.password,
        )
    except RegistrationRejectedError as error:
        raise HTTPException(
            status_code=400,
            detail="Unable to register with the provided credentials",
        ) from error

    return issue_tokens_for_user(db, user, replace_all=True)


@router.post("/login", response_model=TokenPair)
@limiter.limit(settings.rate_limit_auth_login)
def login(request: Request, payload: UserLogin, db: Annotated[Session, Depends(get_db)]):
    try:
        user = authenticate_account(db, str(payload.email), payload.password)
    except InvalidCredentialsError as error:
        _log.warning("auth_login_failed")
        raise HTTPException(status_code=401, detail="Invalid email or password") from error
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
