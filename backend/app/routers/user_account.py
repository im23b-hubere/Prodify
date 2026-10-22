"""Authenticated user account lifecycle endpoints."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import SocialProvider, User, UserIdentity
from app.services.apple_token_client import revoke_refresh_token
from app.services.google_token_client import revoke_token
from app.services.object_storage import ObjectStorageError
from app.services.profile_picture_service import delete_profile_picture
from app.services.subscription_service import RevenueCatDeletionError, delete_revenuecat_subscriber
from app.services.user_deletion_service import delete_review_share_images, delete_user_account

router = APIRouter()
logger = logging.getLogger(__name__)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """Permanently delete the authenticated account and associated data."""
    _revoke_apple_authorizations(db, current)
    _revoke_google_authorizations(db, current)
    try:
        delete_revenuecat_subscriber(str(current.id))
        delete_profile_picture(current.profile_picture_url, required=True)
        delete_review_share_images(db, current.id)
    except (RevenueCatDeletionError, ObjectStorageError) as exc:
        logger.exception("account_deletion_external_cleanup_failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "ACCOUNT_DELETE_INCOMPLETE",
                "message": "The account could not be deleted because a connected service did not respond. Try again.",
            },
        ) from exc
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


def _revoke_google_authorizations(db: Session, user: User) -> None:
    identities = db.scalars(
        select(UserIdentity).where(
            UserIdentity.user_id == user.id,
            UserIdentity.provider == SocialProvider.google.value,
        )
    ).all()
    if not identities:
        return
    tokens = [identity.provider_refresh_token for identity in identities if identity.provider_refresh_token]
    if not tokens:
        logger.info("google_revoke_skipped_no_token")
        return
    for token in tokens:
        revoke_token(token)
