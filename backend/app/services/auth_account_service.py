from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Streak, User
from app.security import hash_password, verify_password


class RegistrationRejectedError(ValueError):
    """Raised when a new account cannot be created.

    reason is one of: email_taken, username_taken, conflict.
    """

    def __init__(self, reason: str = "conflict") -> None:
        self.reason = reason
        super().__init__(reason)


class InvalidCredentialsError(ValueError):
    pass


def register_account(
    db: Session,
    email: str,
    username: str,
    password: str,
) -> User:
    normalized_email = email.strip().lower()
    normalized_username = username.strip().lower()
    email_taken = _email_exists(db, normalized_email)
    username_taken = _username_exists(db, normalized_username)
    if email_taken:
        # Prefer email so a returning user is pointed at sign-in, even if the
        # username they typed is also already in use.
        raise RegistrationRejectedError("email_taken")
    if username_taken:
        raise RegistrationRejectedError("username_taken")
    user = User(
        email=normalized_email,
        username=normalized_username,
        hashed_password=hash_password(password),
    )
    try:
        db.add(user)
        db.flush()
        db.add(Streak(user_id=user.id, current_streak=0, longest_streak=0))
        db.commit()
        db.refresh(user)
    except IntegrityError as error:
        db.rollback()
        raise RegistrationRejectedError(
            _conflict_reason_after_integrity_error(db, normalized_email, normalized_username, error)
        ) from error
    return user


def authenticate_account(db: Session, email: str, password: str) -> User:
    normalized_email = email.strip().lower()
    user = db.scalar(select(User).where(func.lower(User.email) == normalized_email))
    if user is None or not verify_password(password, user.hashed_password):
        raise InvalidCredentialsError
    return user


def _email_exists(db: Session, normalized_email: str) -> bool:
    return db.scalar(select(User.id).where(func.lower(User.email) == normalized_email)) is not None


def _username_exists(db: Session, normalized_username: str) -> bool:
    return db.scalar(
        select(User.id).where(func.lower(User.username) == normalized_username)
    ) is not None


def _conflict_reason_after_integrity_error(
    db: Session,
    normalized_email: str,
    normalized_username: str,
    error: IntegrityError,
) -> str:
    if _email_exists(db, normalized_email):
        return "email_taken"
    if _username_exists(db, normalized_username):
        return "username_taken"
    origin = str(getattr(error, "orig", error)).lower()
    if "username" in origin:
        return "username_taken"
    if "email" in origin:
        return "email_taken"
    return "conflict"
