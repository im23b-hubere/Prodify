from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services import profile_picture_service
from app.services.object_storage import local_upload_dir


class FailingCommitSession:
    def __init__(self) -> None:
        self.rolled_back = False

    def add(self, _user) -> None:
        return None

    def commit(self) -> None:
        raise RuntimeError("database unavailable")

    def rollback(self) -> None:
        self.rolled_back = True

    def refresh(self, _user) -> None:
        raise AssertionError("refresh must not run after a failed commit")


def test_replace_profile_picture_cleans_up_new_file_when_commit_fails(monkeypatch) -> None:
    session = FailingCommitSession()
    user = SimpleNamespace(id=7, profile_picture_url="/uploads/profile_pictures/old.png")
    deleted_urls: list[str | None] = []
    monkeypatch.setattr(
        profile_picture_service,
        "store_profile_picture",
        lambda _user_id, _content, _mime_type: "/uploads/profile_pictures/new.png",
    )
    monkeypatch.setattr(profile_picture_service, "delete_profile_picture", deleted_urls.append)

    with pytest.raises(RuntimeError, match="database unavailable"):
        profile_picture_service.replace_profile_picture(
            session,
            user,
            b"image bytes",
            "image/png",
        )

    assert session.rolled_back is True
    assert user.profile_picture_url == "/uploads/profile_pictures/old.png"
    assert deleted_urls == ["/uploads/profile_pictures/new.png"]


def _jpeg_with_gps_exif() -> bytes:
    from PIL import Image

    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (47.0, 22.0, 0.0)}  # GPSInfo: where the photo was taken
    output = BytesIO()
    Image.new("RGB", (8, 8), "red").save(output, format="JPEG", exif=exif)
    return output.getvalue()


def test_normalize_image_strips_location_metadata_from_photos() -> None:
    from PIL import Image

    original = _jpeg_with_gps_exif()
    assert Image.open(BytesIO(original)).getexif()

    normalized = profile_picture_service.normalize_image(original, "image/jpeg")

    assert normalized != original
    assert not Image.open(BytesIO(normalized)).getexif()


def test_normalize_image_keeps_png_transparency() -> None:
    from PIL import Image

    output = BytesIO()
    Image.new("RGBA", (4, 4), (0, 0, 0, 0)).save(output, format="PNG")

    normalized = profile_picture_service.normalize_image(output.getvalue(), "image/png")

    assert Image.open(BytesIO(normalized)).getpixel((0, 0)) == (0, 0, 0, 0)


def test_public_profile_picture_url_keeps_absolute_urls() -> None:
    assert (
        profile_picture_service.public_profile_picture_url(
            "https://media.example.com/profile_pictures/1-abc.jpg",
            "https://api.example.com",
        )
        == "https://media.example.com/profile_pictures/1-abc.jpg"
    )


def test_public_profile_picture_url_prefixes_relative_paths() -> None:
    assert (
        profile_picture_service.public_profile_picture_url(
            "/uploads/profile_pictures/1-abc.jpg",
            "https://api.example.com",
        )
        == "https://api.example.com/uploads/profile_pictures/1-abc.jpg"
    )


def test_store_profile_picture_uses_object_storage_when_configured(monkeypatch) -> None:
    put = MagicMock(return_value="https://media.example.com/profile_pictures/9-deadbeef.jpg")
    monkeypatch.setattr(profile_picture_service.object_storage, "put_bytes", put)

    url = profile_picture_service.store_profile_picture(9, b"png-bytes", "image/png")

    assert url == "https://media.example.com/profile_pictures/9-deadbeef.jpg"
    put.assert_called_once()
    key, content, content_type = put.call_args.args
    assert key.startswith("profile_pictures/9-")
    assert key.endswith(".png")
    assert content == b"png-bytes"
    assert content_type == "image/png"


def test_delete_profile_picture_removes_remote_object(monkeypatch) -> None:
    monkeypatch.setattr(
        profile_picture_service.object_storage,
        "public_base_url",
        lambda: "https://media.example.com",
    )
    deleted: list[str] = []
    monkeypatch.setattr(profile_picture_service.object_storage, "_delete_remote", deleted.append)

    profile_picture_service.delete_profile_picture(
        "https://media.example.com/profile_pictures/9-deadbeef.jpg"
    )

    assert deleted == ["profile_pictures/9-deadbeef.jpg"]


def test_delete_profile_picture_ignores_path_traversal() -> None:
    sentinel = local_upload_dir().parent / "sentinel-object-storage.txt"
    sentinel.write_text("keep", encoding="utf-8")
    try:
        profile_picture_service.delete_profile_picture(
            "/uploads/profile_pictures/../sentinel-object-storage.txt"
        )
        assert sentinel.exists()
    finally:
        sentinel.unlink(missing_ok=True)


def test_normalize_endpoint_url_strips_bucket_suffix() -> None:
    from app.services.object_storage import normalize_endpoint_url

    assert (
        normalize_endpoint_url(
            "https://abc.r2.cloudflarestorage.com/prodify-media",
            "prodify-media",
        )
        == "https://abc.r2.cloudflarestorage.com"
    )
    assert (
        normalize_endpoint_url("https://abc.r2.cloudflarestorage.com", "prodify-media")
        == "https://abc.r2.cloudflarestorage.com"
    )
