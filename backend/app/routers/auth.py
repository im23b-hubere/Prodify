import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Streak, User
from app.schemas import Token, UserCreate, UserLogin, UserPublic
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
_log = logging.getLogger(__name__)


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Annotated[Session, Depends(get_db)]):
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    db.add(Streak(user_id=user.id, current_streak=0, longest_streak=0))
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    return Token(access_token=token)


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Annotated[Session, Depends(get_db)]):
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.hashed_password):
        _log.warning("auth_login_failed")
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_access_token(str(user.id))
    return Token(access_token=token)


@router.get("/me", response_model=UserPublic)
def me(current: Annotated[User, Depends(get_current_user)]):
    return current
