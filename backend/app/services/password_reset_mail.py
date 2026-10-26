"""The email that carries a password reset code, in the language the app asked for."""

import logging

from app.services import mailer
from app.services.password_reset_service import CODE_LIFETIME, IssuedResetCode

_log = logging.getLogger(__name__)

_MINUTES = int(CODE_LIFETIME.total_seconds() // 60)

_TEMPLATES: dict[str, tuple[str, str]] = {
    "en": (
        "Your Prodify code",
        "Hi {username},\n\n"
        "Use this code to reset your Prodify password:\n\n"
        "{code}\n\n"
        "The code is valid for {minutes} minutes. If you didn't ask to reset your password, "
        "you can ignore this email; your password stays the same.\n\n"
        "— Prodify",
    ),
    "de": (
        "Dein Prodify-Code",
        "Hallo {username}\n\n"
        "Mit diesem Code setzt du dein Prodify-Passwort zurück:\n\n"
        "{code}\n\n"
        "Der Code ist {minutes} Minuten gültig. Wenn du kein neues Passwort angefordert hast, "
        "kannst du diese E-Mail ignorieren; dein Passwort bleibt unverändert.\n\n"
        "— Prodify",
    ),
    "es": (
        "Tu código de Prodify",
        "Hola, {username}:\n\n"
        "Usa este código para restablecer tu contraseña de Prodify:\n\n"
        "{code}\n\n"
        "El código es válido durante {minutes} minutos. Si no pediste restablecer tu "
        "contraseña, ignora este correo; tu contraseña no cambiará.\n\n"
        "— Prodify",
    ),
    "fr": (
        "Ton code Prodify",
        "Bonjour {username},\n\n"
        "Utilise ce code pour réinitialiser ton mot de passe Prodify :\n\n"
        "{code}\n\n"
        "Ce code est valable {minutes} minutes. Si tu n'as pas demandé de nouveau mot de passe, "
        "ignore cet e-mail ; ton mot de passe reste inchangé.\n\n"
        "— Prodify",
    ),
    "it": (
        "Il tuo codice Prodify",
        "Ciao {username},\n\n"
        "usa questo codice per reimpostare la password di Prodify:\n\n"
        "{code}\n\n"
        "Il codice è valido per {minutes} minuti. Se non hai richiesto una nuova password, "
        "ignora questa email: la tua password resta invariata.\n\n"
        "— Prodify",
    ),
    "pt": (
        "Seu código do Prodify",
        "Olá, {username}!\n\n"
        "Use este código para redefinir sua senha do Prodify:\n\n"
        "{code}\n\n"
        "O código é válido por {minutes} minutos. Se você não pediu uma nova senha, ignore "
        "este e-mail; sua senha continua a mesma.\n\n"
        "— Prodify",
    ),
}


def send_password_reset_code(issued: IssuedResetCode, locale: str | None) -> None:
    """Runs after the response is sent, so a mail failure is logged instead of raised."""
    subject, body = _TEMPLATES[_language(locale)]
    try:
        mailer.send_email(
            to=issued.email,
            subject=subject,
            body=body.format(username=issued.username, code=issued.code, minutes=_MINUTES),
        )
    except Exception:
        _log.exception("password_reset_mail_failed")


def _language(locale: str | None) -> str:
    language = (locale or "").replace("_", "-").split("-", 1)[0].strip().lower()
    return language if language in _TEMPLATES else "en"
