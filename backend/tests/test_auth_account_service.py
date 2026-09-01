import pytest
from sqlalchemy.exc import IntegrityError

from app.services import auth_account_service


class ConflictingRegistrationSession:
    def __init__(self) -> None:
        self.rolled_back = False

    def add(self, _model) -> None:
        return None

    def flush(self) -> None:
        raise IntegrityError("insert user", {}, RuntimeError("unique constraint"))

    def commit(self) -> None:
        raise AssertionError("commit must not run after a failed flush")

    def refresh(self, _model) -> None:
        raise AssertionError("refresh must not run after a failed flush")

    def rollback(self) -> None:
        self.rolled_back = True


def test_registration_converts_concurrent_uniqueness_failure(monkeypatch) -> None:
    db = ConflictingRegistrationSession()
    monkeypatch.setattr(auth_account_service, "_email_exists", lambda *_args: False)
    monkeypatch.setattr(auth_account_service, "_username_exists", lambda *_args: False)
    monkeypatch.setattr(auth_account_service, "hash_password", lambda _password: "hash")

    with pytest.raises(auth_account_service.RegistrationRejectedError) as rejected:
        auth_account_service.register_account(
            db,
            "new@example.com",
            "new-user",
            "strong-password",
        )

    assert rejected.value.reason == "conflict"
    assert db.rolled_back is True


def test_register_account_reports_email_taken(monkeypatch) -> None:
    monkeypatch.setattr(auth_account_service, "_email_exists", lambda *_args: True)
    monkeypatch.setattr(auth_account_service, "_username_exists", lambda *_args: False)

    with pytest.raises(auth_account_service.RegistrationRejectedError) as rejected:
        auth_account_service.register_account(object(), "taken@example.com", "fresh-user", "password")

    assert rejected.value.reason == "email_taken"


def test_register_account_reports_username_taken(monkeypatch) -> None:
    monkeypatch.setattr(auth_account_service, "_email_exists", lambda *_args: False)
    monkeypatch.setattr(auth_account_service, "_username_exists", lambda *_args: True)

    with pytest.raises(auth_account_service.RegistrationRejectedError) as rejected:
        auth_account_service.register_account(object(), "fresh@example.com", "taken-user", "password")

    assert rejected.value.reason == "username_taken"
