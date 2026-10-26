import pytest

from app.config import settings
from app.services import mailer
from app.services.password_reset_mail import send_password_reset_code
from app.services.password_reset_service import IssuedResetCode


class FakeSmtp:
    instances: list["FakeSmtp"] = []

    def __init__(self, host, port, timeout=None, context=None):
        self.host = host
        self.port = port
        self.started_tls = False
        self.logins: list[tuple[str, str]] = []
        self.messages = []
        FakeSmtp.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self, context=None):
        self.started_tls = True

    def login(self, username, password):
        self.logins.append((username, password))

    def send_message(self, message):
        self.messages.append(message)


@pytest.fixture
def smtp(monkeypatch):
    FakeSmtp.instances = []
    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSmtp)
    monkeypatch.setattr(mailer.smtplib, "SMTP_SSL", FakeSmtp)
    monkeypatch.setattr(settings, "smtp_host", "mail.example.com")
    monkeypatch.setattr(settings, "smtp_username", "sender@example.com")
    monkeypatch.setattr(settings, "smtp_password", "app-password")
    monkeypatch.setattr(settings, "mail_from", None)
    return FakeSmtp


def _send():
    mailer.send_email(to="user@example.com", subject="Subject", body="Body")


def test_submission_port_upgrades_with_starttls_and_signs_in(smtp, monkeypatch):
    monkeypatch.setattr(settings, "smtp_port", 587)

    _send()

    connection = smtp.instances[0]
    assert connection.started_tls
    assert connection.logins == [("sender@example.com", "app-password")]
    assert connection.messages[0]["To"] == "user@example.com"


def test_port_465_uses_implicit_tls(smtp, monkeypatch):
    monkeypatch.setattr(settings, "smtp_port", 465)

    _send()

    assert not smtp.instances[0].started_tls
    assert len(smtp.instances[0].messages) == 1


def test_mail_comes_from_the_signed_in_account_unless_a_sender_is_set(smtp, monkeypatch):
    _send()
    monkeypatch.setattr(settings, "mail_from", "no-reply@example.com")
    _send()

    assert smtp.instances[0].messages[0]["From"] == "Prodify <sender@example.com>"
    assert smtp.instances[1].messages[0]["From"] == "Prodify <no-reply@example.com>"


def test_sending_without_a_configured_server_fails_loudly(monkeypatch):
    monkeypatch.setattr(settings, "smtp_host", None)

    with pytest.raises(mailer.MailNotConfiguredError):
        _send()


def test_reset_mail_failure_is_logged_instead_of_raised(monkeypatch, caplog):
    def fail(**_kwargs):
        raise OSError("connection refused")

    monkeypatch.setattr(mailer, "send_email", fail)

    send_password_reset_code(IssuedResetCode("user@example.com", "producer", "123456"), "en")

    assert "password_reset_mail_failed" in caplog.text
