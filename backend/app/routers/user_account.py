"""Authenticated user account lifecycle endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import SocialProvider, User, UserIdentity
from app.services.apple_token_client import revoke_refresh_token
from app.services.profile_picture_service import delete_profile_picture
from app.services.user_deletion_service import delete_user_account

router = APIRouter()


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """Permanently delete the authenticated account and associated data."""
    _revoke_apple_authorizations(db, current)
    delete_profile_picture(current.profile_picture_url)
    delete_user_account(db, current)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _revoke_apple_authorizations(db: Session, user: User) -> None:
    if not settings.apple_audiences:
        return
    refresh_tokens = db.scalars(
        select(UserIdentity.provider_refresh_token).where(
            UserIdentity.user_id == user.id,
            UserIdentity.provider == SocialProvider.apple.value,
            UserIdentity.provider_refresh_token.is_not(None),
        )
    ).all()
    for refresh_token in refresh_tokens:
        revoke_refresh_token(refresh_token, settings.apple_audiences[0])
