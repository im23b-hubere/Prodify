"""Processing, storage, and replacement operations for profile pictures."""

import secrets
from io import BytesIO
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import User

PROFILE_UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "profile_pictures"
PROFILE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MIME_TO_EXTENSION = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
PROFILE_PICTURE_URL_PREFIX = "/uploads/profile_pictures/"


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
    filename = f"{user_id}-{secrets.token_hex(8)}{MIME_TO_EXTENSION[mime_type]}"
    (PROFILE_UPLOAD_DIR / filename).write_bytes(content)
    return f"{PROFILE_PICTURE_URL_PREFIX}{filename}"


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
    if not profile_picture_url or PROFILE_PICTURE_URL_PREFIX not in profile_picture_url:
        return

    file_name = profile_picture_url.split(PROFILE_PICTURE_URL_PREFIX, 1)[1].strip("/")
    if not file_name:
        return

    base_dir = PROFILE_UPLOAD_DIR.resolve()
    file_path = (PROFILE_UPLOAD_DIR / file_name).resolve()
    if base_dir in file_path.parents:
        file_path.unlink(missing_ok=True)
