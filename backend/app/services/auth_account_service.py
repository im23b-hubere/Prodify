from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Streak, User
from app.security import hash_password, verify_password


class RegistrationRejectedError(ValueError):
    pass


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
    if _email_exists(db, normalized_email) or _username_exists(db, normalized_username):
        raise RegistrationRejectedError
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
        raise RegistrationRejectedError from error
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
