import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.contracts.auth import (
    AppleSignIn,
    GoogleSignIn,
    RefreshRequest,
    TokenPair,
    UserAccountPublic,
    UserCreate,
    UserLogin,
)
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
from app.services.apple_token_client import exchange_authorization_code
from app.services.auth_token_service import (
    RefreshTokenRejected,
    issue_tokens_for_user,
    revoke_user_tokens,
    rotate_refresh_token,
)
from app.services.social_account_service import SocialAccountRejectedError, find_or_create_social_account
from app.services.social_identity_service import (
    SocialTokenRejectedError,
    VerifiedIdentity,
    verify_apple_identity_token,
    verify_google_id_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])
_log = logging.getLogger(__name__)

_REGISTRATION_ERRORS: dict[str, tuple[int, dict[str, str]]] = {
    "email_taken": (
        status.HTTP_409_CONFLICT,
        {
            "code": "EMAIL_TAKEN",
            "message": "This email is already registered. Try signing in.",
        },
    ),
    "username_taken": (
        status.HTTP_409_CONFLICT,
        {
            "code": "USERNAME_TAKEN",
            "message": "This username is already taken.",
        },
    ),
}


def _registration_http_error(error: RegistrationRejectedError) -> HTTPException:
    status_code, detail = _REGISTRATION_ERRORS.get(
        error.reason,
        (
            status.HTTP_409_CONFLICT,
            {
                "code": "REGISTRATION_CONFLICT",
                "message": "This email or username is already in use.",
            },
        ),
    )
    return HTTPException(status_code=status_code, detail=detail)


_SOCIAL_ACCOUNT_ERRORS: dict[str, tuple[int, dict[str, str]]] = {
    "email_required": (
        status.HTTP_400_BAD_REQUEST,
        {
            "code": "SOCIAL_EMAIL_REQUIRED",
            "message": "Share your email address to create a Prodify account.",
        },
    ),
    "email_unverified": (
        status.HTTP_409_CONFLICT,
        {
            "code": "EMAIL_TAKEN",
            "message": "This email is already registered. Sign in with your password.",
        },
    ),
}


def _social_sign_in(
    db: Session,
    identity: VerifiedIdentity,
    *,
    given_name: str | None = None,
    apple_authorization_code: str | None = None,
) -> TokenPair:
    try:
        linked = find_or_create_social_account(db, identity, given_name=given_name)
    except SocialAccountRejectedError as error:
        status_code, detail = _SOCIAL_ACCOUNT_ERRORS[error.reason]
        raise HTTPException(status_code=status_code, detail=detail) from error

    if apple_authorization_code:
        refresh_token = exchange_authorization_code(apple_authorization_code, settings.apple_audiences[0])
        if refresh_token:
            linked.provider_refresh_token = refresh_token
            db.commit()

    return issue_tokens_for_user(db, linked.user, replace_all=True)


def _social_token_rejected() -> HTTPException:
    _log.warning("auth_social_token_rejected")
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "SOCIAL_TOKEN_INVALID", "message": "Sign-in could not be verified. Please try again."},
    )


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
        raise _registration_http_error(error) from error

    return issue_tokens_for_user(db, user, replace_all=True)


@router.post("/login", response_model=TokenPair)
@limiter.limit(settings.rate_limit_auth_login)
def login(request: Request, payload: UserLogin, db: Annotated[Session, Depends(get_db)]):
    try:
        user = authenticate_account(db, str(payload.email), payload.password)
    except InvalidCredentialsError as error:
        _log.warning("auth_login_failed")
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password"},
        ) from error
    return issue_tokens_for_user(db, user, replace_all=True)


@router.post("/apple", response_model=TokenPair)
@limiter.limit(settings.rate_limit_auth_login)
def sign_in_with_apple(request: Request, payload: AppleSignIn, db: Annotated[Session, Depends(get_db)]):
    try:
        identity = verify_apple_identity_token(payload.identity_token, settings.apple_audiences)
    except SocialTokenRejectedError as error:
        raise _social_token_rejected() from error
    return _social_sign_in(
        db,
        identity,
        given_name=payload.given_name,
        apple_authorization_code=payload.authorization_code,
    )


@router.post("/google", response_model=TokenPair)
@limiter.limit(settings.rate_limit_auth_login)
def sign_in_with_google(request: Request, payload: GoogleSignIn, db: Annotated[Session, Depends(get_db)]):
    if not settings.google_audiences:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "SOCIAL_PROVIDER_UNAVAILABLE", "message": "Google sign-in is not available."},
        )
    try:
        identity = verify_google_id_token(payload.id_token, settings.google_audiences)
    except SocialTokenRejectedError as error:
        raise _social_token_rejected() from error
    return _social_sign_in(db, identity)


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
