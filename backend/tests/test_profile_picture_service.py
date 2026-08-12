from types import SimpleNamespace

import pytest

from app.services import profile_picture_service


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
