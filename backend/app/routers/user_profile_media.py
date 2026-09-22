"""Authenticated profile-picture upload endpoint."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.contracts.auth import UserAccountPublic
from app.database import get_db
from app.dependencies import get_current_user
from app.errors import APIError
from app.models import User
from app.services.object_storage import ObjectStorageError
from app.services.profile_picture_service import (
    ALLOWED_IMAGE_MIME_TYPES,
    MAX_PROFILE_IMAGE_BYTES,
    detect_image_mime,
    public_profile_picture_url,
    replace_profile_picture,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/me/profile-picture", response_model=UserAccountPublic)
async def upload_profile_picture(
    request: Request,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    declared_content_type = (file.content_type or "").lower().strip()
    # Expo File uploads sometimes omit Content-Type; magic-byte detection is authoritative.
    if declared_content_type and not declared_content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image uploads are allowed")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded image is empty")
    if len(content) > MAX_PROFILE_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="Image exceeds 5MB limit")

    detected_mime = detect_image_mime(content)
    if detected_mime not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image format")

    try:
        current = replace_profile_picture(db, current, content, detected_mime)
    except ObjectStorageError as exc:
        raise APIError(
            status_code=status.HTTP_502_BAD_GATEWAY,
            message=str(exc),
            code="OBJECT_STORAGE_FAILED",
        ) from exc
    except Exception as exc:
        logger.exception("Profile picture upload failed for user_id=%s", current.id)
        raise APIError(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="Could not update profile picture.",
            code="PROFILE_PICTURE_UPLOAD_FAILED",
        ) from exc

    absolute_url = public_profile_picture_url(
        current.profile_picture_url,
        str(request.base_url).rstrip("/"),
    )
    return UserAccountPublic(
        id=current.id,
        email=current.email,
        username=current.username,
        profile_picture_url=absolute_url,
        is_premium=bool(int(current.is_premium or 0)),
        created_at=current.created_at,
    )
