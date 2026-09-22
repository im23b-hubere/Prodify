"""S3-compatible object storage (Cloudflare R2) with a local filesystem fallback.

Local disk is for development only. Production must configure object storage so
profile pictures survive deploys and restarts.
"""

from __future__ import annotations

import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

PROFILE_PICTURE_KEY_PREFIX = "profile_pictures/"
LOCAL_URL_PREFIX = "/uploads/profile_pictures/"


def object_storage_is_configured() -> bool:
    return bool(
        (settings.object_storage_endpoint_url or "").strip()
        and (settings.object_storage_access_key_id or "").strip()
        and (settings.object_storage_secret_access_key or "").strip()
        and (settings.object_storage_bucket or "").strip()
        and (settings.object_storage_public_base_url or "").strip()
    )


def public_base_url() -> str:
    return (settings.object_storage_public_base_url or "").rstrip("/")


def is_remote_public_url(url: str) -> bool:
    base = public_base_url()
    if not base:
        return False
    return url.startswith(f"{base}/") or url == base


def local_upload_dir() -> Path:
    path = Path(__file__).resolve().parents[2] / "uploads" / "profile_pictures"
    path.mkdir(parents=True, exist_ok=True)
    return path


def put_bytes(key: str, content: bytes, content_type: str) -> str:
    """Store bytes and return the public URL (absolute for R2, relative for local)."""
    if object_storage_is_configured():
        return _put_remote(key, content, content_type)
    return _put_local(key, content)


def delete_by_public_url(url: str | None) -> None:
    """Delete the object behind a stored profile_picture_url. No-op if unknown/missing."""
    if not url or not url.strip():
        return
    normalized = url.strip()

    if is_remote_public_url(normalized):
        key = normalized[len(public_base_url()) :].lstrip("/")
        if key:
            _delete_remote(key)
        return

    if LOCAL_URL_PREFIX in normalized:
        file_name = normalized.split(LOCAL_URL_PREFIX, 1)[1].strip("/")
        _delete_local(file_name)


def _put_local(key: str, content: bytes) -> str:
    file_name = key.split("/", 1)[-1]
    if not file_name or "/" in file_name or ".." in file_name:
        raise ValueError("Invalid local object key")
    target = local_upload_dir() / file_name
    target.write_bytes(content)
    return f"{LOCAL_URL_PREFIX}{file_name}"


def _delete_local(file_name: str) -> None:
    if not file_name:
        return
    base_dir = local_upload_dir().resolve()
    file_path = (local_upload_dir() / file_name).resolve()
    if base_dir not in file_path.parents:
        return
    file_path.unlink(missing_ok=True)


def _s3_client():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=settings.object_storage_endpoint_url.strip(),
        aws_access_key_id=settings.object_storage_access_key_id.strip(),
        aws_secret_access_key=settings.object_storage_secret_access_key.strip(),
        region_name=(settings.object_storage_region or "auto").strip(),
        config=Config(signature_version="s3v4"),
    )


def _put_remote(key: str, content: bytes, content_type: str) -> str:
    if ".." in key or key.startswith("/"):
        raise ValueError("Invalid object key")
    client = _s3_client()
    client.put_object(
        Bucket=settings.object_storage_bucket.strip(),
        Key=key,
        Body=content,
        ContentType=content_type,
        CacheControl="public, max-age=31536000, immutable",
    )
    return f"{public_base_url()}/{key}"


def _delete_remote(key: str) -> None:
    if not key or ".." in key:
        return
    try:
        _s3_client().delete_object(
            Bucket=settings.object_storage_bucket.strip(),
            Key=key,
        )
    except Exception:
        logger.exception("Failed to delete object storage key=%s", key)
