"""Processing, storage, and replacement operations for profile pictures."""

from __future__ import annotations

import secrets
from io import BytesIO

from sqlalchemy.orm import Session

from app.models import User
from app.services import object_storage

# Kept for tests and callers that still reference the local upload directory.
PROFILE_UPLOAD_DIR = object_storage.local_upload_dir()
PROFILE_PICTURE_URL_PREFIX = object_storage.LOCAL_URL_PREFIX

MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MIME_TO_EXTENSION = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def detect_image_mime(content: bytes) -> str | None:
    if len(content) >= 8 and content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(content) >= 3 and content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def normalize_image(content: bytes, mime_type: str) -> bytes:
    """Strip metadata when Pillow can decode the supplied image."""
    try:
        from PIL import Image

        image = Image.open(BytesIO(content))
        image = image.convert("RGB") if mime_type == "image/jpeg" else image.convert("RGBA")
        output = BytesIO()
        if mime_type == "image/jpeg":
            image.save(output, format="JPEG", quality=88, optimize=True)
        elif mime_type == "image/png":
            image.save(output, format="PNG", optimize=True)
        else:
            image.save(output, format="WEBP", quality=85, method=6)
        return output.getvalue()
    except Exception:
        return content


def store_profile_picture(user_id: int, content: bytes, mime_type: str) -> str:
    extension = MIME_TO_EXTENSION[mime_type]
    key = f"{object_storage.PROFILE_PICTURE_KEY_PREFIX}{user_id}-{secrets.token_hex(8)}{extension}"
    return object_storage.put_bytes(key, content, mime_type)


def public_profile_picture_url(stored: str | None, api_base_url: str) -> str | None:
    """Return a client-ready absolute URL for a stored profile_picture_url value."""
    if not stored:
        return None
    if stored.startswith("http://") or stored.startswith("https://"):
        return stored
    return f"{api_base_url.rstrip('/')}{stored}"


def replace_profile_picture(db: Session, user: User, content: bytes, mime_type: str) -> User:
    old_url = user.profile_picture_url
    new_url = store_profile_picture(user.id, normalize_image(content, mime_type), mime_type)
    user.profile_picture_url = new_url
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        user.profile_picture_url = old_url
        delete_profile_picture(new_url)
        raise
    delete_profile_picture(old_url)
    return user


def delete_profile_picture(profile_picture_url: str | None) -> None:
    object_storage.delete_by_public_url(profile_picture_url)
