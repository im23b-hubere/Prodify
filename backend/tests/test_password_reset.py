import re
from datetime import timedelta

import pytest
from sqlalchemy import update

from app.database import SessionLocal
from app.models import PasswordResetCode, User, utcnow
from tests.auth_helpers import DEFAULT_PASSWORD

NEW_PASSWORD = "brand-new-pass-456"


@pytest.fixture
def sent_mails(monkeypatch):
    mails: list[dict[str, str]] = []

    def capture(*, to: str, subject: str, body: str) -> None:
        mails.append({"to": to, "subject": subject, "body": body})

    monkeypatch.setattr("app.services.mailer.send_email", capture)
    return mails


def _register(client, email: str = "reset@example.com", username: str = "reset-user") -> dict:
    response = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": DEFAULT_PASSWORD},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _request_code(client, email: str, locale: str | None = None):
    body = {"email": email} if locale is None else {"email": email, "locale": locale}
    return client.post("/auth/password-reset/request", json=body)


def _code_from(mail: dict[str, str]) -> str:
    match = re.search(r"\b(\d{6})\b", mail["body"])
    assert match, mail["body"]
    return match.group(1)


def _confirm(client, email: str, code: str, password: str = NEW_PASSWORD):
    return client.post(
        "/auth/password-reset/confirm",
        json={"email": email, "code": code, "new_password": password},
    )


def _login_status(client, email: str, password: str) -> int:
    return client.post("/auth/login", json={"email": email, "password": password}).status_code


def _other_code(code: str) -> str:
    return "000000" if code != "000000" else "111111"


def test_request_for_unknown_email_looks_successful_and_sends_nothing(client, sent_mails):
    response = _request_code(client, "nobody@example.com")

    assert response.status_code == 202
    assert sent_mails == []


def test_request_mails_a_six_digit_code_to_the_account_address(client, sent_mails):
    _register(client)

    response = _request_code(client, "Reset@Example.com ")

    assert response.status_code == 202
    assert len(sent_mails) == 1
    assert sent_mails[0]["to"] == "reset@example.com"
    _code_from(sent_mails[0])


def test_request_answers_the_same_whether_or_not_the_account_exists(client, sent_mails):
    _register(client)

    known = _request_code(client, "reset@example.com")
    unknown = _request_code(client, "nobody@example.com")

    assert known.status_code == unknown.status_code
    assert known.json() == unknown.json()


def test_mail_uses_the_requested_language(client, sent_mails):
    _register(client)

    _request_code(client, "reset@example.com", locale="de-CH")

    assert "Code" in sent_mails[0]["subject"]
    assert "Passwort" in sent_mails[0]["body"]


def test_mail_falls_back_to_english_for_unknown_languages(client, sent_mails):
    _register(client)

    _request_code(client, "reset@example.com", locale="xx")

    assert "password" in sent_mails[0]["body"].lower()


def test_correct_code_replaces_the_password_and_signs_in(client, sent_mails):
    _register(client)
    _request_code(client, "reset@example.com")

    response = _confirm(client, "reset@example.com", _code_from(sent_mails[0]))

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert _login_status(client, "reset@example.com", NEW_PASSWORD) == 200
    assert _login_status(client, "reset@example.com", DEFAULT_PASSWORD) == 401


def test_reset_signs_out_every_other_session(client, sent_mails):
    old_session = _register(client)
    _request_code(client, "reset@example.com")

    _confirm(client, "reset@example.com", _code_from(sent_mails[0]))

    refresh = client.post("/auth/refresh", json={"refresh_token": old_session["refresh_token"]})
    assert refresh.status_code == 401
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {old_session['access_token']}"})
    assert me.status_code == 401


def test_wrong_code_is_rejected_and_keeps_the_old_password(client, sent_mails):
    _register(client)
    _request_code(client, "reset@example.com")

    response = _confirm(client, "reset@example.com", _other_code(_code_from(sent_mails[0])))

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "RESET_CODE_INVALID"
    assert _login_status(client, "reset@example.com", DEFAULT_PASSWORD) == 200


def test_code_stops_working_after_five_wrong_attempts(client, sent_mails):
    _register(client)
    _request_code(client, "reset@example.com")
    code = _code_from(sent_mails[0])

    for _ in range(5):
        _confirm(client, "reset@example.com", _other_code(code))

    assert _confirm(client, "reset@example.com", code).status_code == 400


def test_expired_code_is_rejected(client, sent_mails):
    _register(client)
    _request_code(client, "reset@example.com")
    with SessionLocal() as db:
        db.execute(update(PasswordResetCode).values(expires_at=utcnow() - timedelta(seconds=1)))
        db.commit()

    response = _confirm(client, "reset@example.com", _code_from(sent_mails[0]))

    assert response.status_code == 400


def test_code_works_only_once(client, sent_mails):
    _register(client)
    _request_code(client, "reset@example.com")
    code = _code_from(sent_mails[0])

    _confirm(client, "reset@example.com", code)

    assert _confirm(client, "reset@example.com", code, "another-pass-789").status_code == 400


def test_code_only_works_for_the_account_it_was_sent_to(client, sent_mails):
    _register(client)
    _register(client, "other@example.com", "other-user")
    _request_code(client, "reset@example.com")

    response = _confirm(client, "other@example.com", _code_from(sent_mails[0]))

    assert response.status_code == 400


def test_repeated_request_within_a_minute_sends_no_second_mail(client, sent_mails):
    _register(client)

    _request_code(client, "reset@example.com")
    _request_code(client, "reset@example.com")

    assert len(sent_mails) == 1


def test_new_code_replaces_the_previous_one(client, sent_mails):
    _register(client)
    _request_code(client, "reset@example.com")
    first_code = _code_from(sent_mails[0])
    with SessionLocal() as db:
        db.execute(update(PasswordResetCode).values(created_at=utcnow() - timedelta(minutes=2)))
        db.commit()

    _request_code(client, "reset@example.com")
    second_code = _code_from(sent_mails[1])

    if first_code != second_code:
        assert _confirm(client, "reset@example.com", first_code).status_code == 400
    assert _confirm(client, "reset@example.com", second_code).status_code == 200


def test_account_created_with_apple_can_set_a_password(client, sent_mails):
    _register(client)
    with SessionLocal() as db:
        db.execute(update(User).values(hashed_password=None))
        db.commit()
    _request_code(client, "reset@example.com")

    _confirm(client, "reset@example.com", _code_from(sent_mails[0]))

    assert _login_status(client, "reset@example.com", NEW_PASSWORD) == 200


def test_new_password_must_have_at_least_eight_characters(client, sent_mails):
    _register(client)
    _request_code(client, "reset@example.com")

    response = _confirm(client, "reset@example.com", _code_from(sent_mails[0]), "short")

    assert response.status_code == 422
    assert _login_status(client, "reset@example.com", DEFAULT_PASSWORD) == 200
