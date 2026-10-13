"""Resolve a verified Apple / Google identity to a Prodify account."""

import re
import secrets

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Streak, User, UserIdentity
from app.services.content_filter import is_objectionable
from app.services.social_identity_service import VerifiedIdentity

_USERNAME_MAX_BASE_LENGTH = 20
_USERNAME_ATTEMPTS = 8
_FALLBACK_USERNAME_BASE = "producer"


class SocialAccountRejectedError(ValueError):
    """reason is one of: email_required, email_unverified."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


def find_or_create_social_account(
    db: Session,
    identity: VerifiedIdentity,
    *,
    given_name: str | None = None,
) -> UserIdentity:
    """Returns the linked identity; its `user` is the account to sign in."""
    for _ in range(_USERNAME_ATTEMPTS):
        linked = _linked_identity(db, identity)
        if linked is not None:
            return linked
        try:
            return _link_or_create(db, identity, given_name)
        except IntegrityError:
            # Lost a race on username, email or identity; resolve again from the committed state.
            db.rollback()
    raise RuntimeError("could not resolve social sign-in to an account")


def _link_or_create(db: Session, identity: VerifiedIdentity, given_name: str | None) -> UserIdentity:
    if not identity.email:
        raise SocialAccountRejectedError("email_required")

    user = db.scalar(select(User).where(func.lower(User.email) == identity.email))
    if user is not None and not identity.is_email_verified:
        # Linking by email is only safe when the provider proved ownership of that address.
        raise SocialAccountRejectedError("email_unverified")
    if user is None:
        user = _new_user(db, identity.email, _username_base(given_name, identity.email))

    linked = UserIdentity(user_id=user.id, provider=identity.provider.value, subject=identity.subject)
    db.add(linked)
    db.commit()
    db.refresh(linked)
    return linked


def _new_user(db: Session, email: str, username_base: str) -> User:
    user = User(email=email, username=_available_username(db, username_base), hashed_password=None)
    db.add(user)
    db.flush()
    db.add(Streak(user_id=user.id, current_streak=0, longest_streak=0))
    return user


def _linked_identity(db: Session, identity: VerifiedIdentity) -> UserIdentity | None:
    return db.scalar(
        select(UserIdentity).where(
            UserIdentity.provider == identity.provider.value,
            UserIdentity.subject == identity.subject,
        )
    )


def _username_base(given_name: str | None, email: str) -> str:
    for candidate in (given_name, email.split("@", 1)[0]):
        slug = re.sub(r"[^a-z0-9_]+", "", (candidate or "").strip().lower())[:_USERNAME_MAX_BASE_LENGTH]
        if len(slug) >= 2 and not is_objectionable(slug):
            return slug
    return _FALLBACK_USERNAME_BASE


def _available_username(db: Session, base: str) -> str:
    if not _username_taken(db, base):
        return base
    for _ in range(_USERNAME_ATTEMPTS):
        candidate = f"{base}{secrets.randbelow(10_000):04d}"
        if not _username_taken(db, candidate):
            return candidate
    return f"{base}{secrets.token_hex(4)}"


def _username_taken(db: Session, username: str) -> bool:
    return db.scalar(select(User.id).where(func.lower(User.username) == username)) is not None
