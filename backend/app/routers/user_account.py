"""Authenticated user account lifecycle endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services.profile_picture_service import delete_profile_picture
from app.services.user_deletion_service import delete_user_account

router = APIRouter()


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """Permanently delete the authenticated account and associated data."""
    delete_profile_picture(current.profile_picture_url)
    delete_user_account(db, current)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
