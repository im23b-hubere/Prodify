"""Authenticated profile-picture upload endpoint."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.contracts.auth import UserAccountPublic
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services.profile_picture_service import (
    ALLOWED_IMAGE_MIME_TYPES,
    MAX_PROFILE_IMAGE_BYTES,
    delete_profile_picture,
    detect_image_mime,
    normalize_image,
    store_profile_picture,
)

router = APIRouter()


@router.post("/me/profile-picture", response_model=UserAccountPublic)
async def upload_profile_picture(
    request: Request,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    declared_content_type = (file.content_type or "").lower().strip()
    if not declared_content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image uploads are allowed")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded image is empty")
    if len(content) > MAX_PROFILE_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="Image exceeds 5MB limit")

    detected_mime = detect_image_mime(content)
    if detected_mime not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image format")

    old_url = current.profile_picture_url
    current.profile_picture_url = store_profile_picture(
        current.id,
        normalize_image(content, detected_mime),
        detected_mime,
    )
    db.add(current)
    db.commit()
    db.refresh(current)
    delete_profile_picture(old_url)

    base_url = str(request.base_url).rstrip("/")
    absolute_url = f"{base_url}{current.profile_picture_url}" if current.profile_picture_url else None
    return UserAccountPublic(
        id=current.id,
        email=current.email,
        username=current.username,
        profile_picture_url=absolute_url,
        is_premium=bool(int(current.is_premium or 0)),
        created_at=current.created_at,
    )
