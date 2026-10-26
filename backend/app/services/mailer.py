"""Plain-text email over SMTP."""

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app.config import settings

_IMPLICIT_TLS_PORT = 465
_TIMEOUT_SECONDS = 20


class MailNotConfiguredError(RuntimeError):
    """SMTP_HOST is not set, so the API cannot send email."""


def send_email(*, to: str, subject: str, body: str) -> None:
    if not settings.smtp_host:
        raise MailNotConfiguredError("SMTP_HOST is not set")
    message = EmailMessage()
    message["From"] = formataddr(("Prodify", _sender_address()))
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    context = ssl.create_default_context()
    if settings.smtp_port == _IMPLICIT_TLS_PORT:
        with smtplib.SMTP_SSL(
            settings.smtp_host, settings.smtp_port, timeout=_TIMEOUT_SECONDS, context=context
        ) as smtp:
            _authenticate_and_send(smtp, message)
        return
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=_TIMEOUT_SECONDS) as smtp:
        smtp.starttls(context=context)
        _authenticate_and_send(smtp, message)


def _sender_address() -> str:
    return settings.mail_from or settings.smtp_username or settings.support_email


def _authenticate_and_send(smtp: smtplib.SMTP, message: EmailMessage) -> None:
    if settings.smtp_username:
        smtp.login(settings.smtp_username, settings.smtp_password or "")
    smtp.send_message(message)
