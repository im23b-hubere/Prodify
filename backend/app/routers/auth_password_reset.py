from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.contracts.auth import PasswordResetConfirm, PasswordResetRequest, TokenPair
from app.database import get_db
from app.rate_limit import limiter
from app.services.auth_token_service import issue_tokens_for_user
from app.services.password_reset_mail import send_password_reset_code
from app.services.password_reset_service import (
    InvalidResetCodeError,
    issue_reset_code,
    reset_password_with_code,
)

router = APIRouter(prefix="/auth/password-reset", tags=["auth"])


@router.post("/request", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(settings.rate_limit_auth_password_reset)
def request_password_reset(
    request: Request,
    payload: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
):
    # Same answer for every address, so the endpoint never reveals who has an account; the
    # mail goes out after the response, so its delay does not reveal it either.
    issued = issue_reset_code(db, str(payload.email))
    if issued is not None:
        background_tasks.add_task(send_password_reset_code, issued, payload.locale)
    return {"ok": True}


@router.post("/confirm", response_model=TokenPair)
@limiter.limit(settings.rate_limit_auth_login)
def confirm_password_reset(
    request: Request,
    payload: PasswordResetConfirm,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        user = reset_password_with_code(db, str(payload.email), payload.code, payload.new_password)
    except InvalidResetCodeError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "RESET_CODE_INVALID",
                "message": "This code is wrong or has expired. Request a new one.",
            },
        ) from error
    return issue_tokens_for_user(db, user, replace_all=True)
