"""Reset a forgotten password with a short-lived code sent to the account's email address."""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import PasswordResetCode, User, utcnow
from app.security import hash_password
from app.services.auth_token_service import revoke_user_tokens
from app.timeutil import as_utc_aware

CODE_LIFETIME = timedelta(minutes=15)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_FAILED_ATTEMPTS = 5


@dataclass(frozen=True)
class IssuedResetCode:
    email: str
    username: str
    code: str


class InvalidResetCodeError(ValueError):
    """The code is wrong, expired, used up, or was never sent to this address."""


def issue_reset_code(db: Session, email: str) -> IssuedResetCode | None:
    """Store a fresh code for the account and return it for mailing.

    Returns None for unknown addresses and while the previous code is still within its resend
    cooldown, so callers answer every request the same way and a script cannot flood an inbox.
    """
    user = _user_by_email(db, email)
    if user is None:
        return None
    now = utcnow()
    previous = _stored_code(db, user)
    if previous is not None:
        if as_utc_aware(previous.created_at) > now - RESEND_COOLDOWN:
            return None
        db.delete(previous)
        db.flush()
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        PasswordResetCode(
            user_id=user.id,
            code_hash=_code_hash(user.id, code),
            expires_at=now + CODE_LIFETIME,
            created_at=now,
        )
    )
    db.commit()
    return IssuedResetCode(email=user.email, username=user.username, code=code)


def reset_password_with_code(db: Session, email: str, code: str, new_password: str) -> User:
    """Replace the password and sign out every session; the code works once."""
    user = _user_by_email(db, email)
    stored = _stored_code(db, user) if user is not None else None
    if user is None or stored is None:
        raise InvalidResetCodeError
    if _is_used_up(stored):
        db.delete(stored)
        db.commit()
        raise InvalidResetCodeError
    if not hmac.compare_digest(stored.code_hash, _code_hash(user.id, code)):
        stored.failed_attempts += 1
        db.commit()
        raise InvalidResetCodeError
    db.delete(stored)
    user.hashed_password = hash_password(new_password)
    revoke_user_tokens(db, user)
    return user


def _is_used_up(stored: PasswordResetCode) -> bool:
    return (
        as_utc_aware(stored.expires_at) <= utcnow()
        or stored.failed_attempts >= MAX_FAILED_ATTEMPTS
    )


def _user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))


def _stored_code(db: Session, user: User) -> PasswordResetCode | None:
    return db.scalar(select(PasswordResetCode).where(PasswordResetCode.user_id == user.id))


def _code_hash(user_id: int, code: str) -> str:
    # Keyed, because a leaked table must not reveal codes: a plain hash of six digits is
    # reversed by trying all million of them.
    message = f"{user_id}:{code}".encode("utf-8")
    return hmac.new(settings.secret_key.encode("utf-8"), message, hashlib.sha256).hexdigest()
