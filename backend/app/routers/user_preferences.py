"""Device-reported settings that change how the server interprets a user's data."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.contracts.auth import UserTimezonePublic, UserTimezoneUpdate
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User

router = APIRouter()


@router.put("/me/timezone", response_model=UserTimezonePublic)
def set_my_timezone(
    payload: UserTimezoneUpdate,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserTimezonePublic:
    """
    Store the device's IANA timezone so streak days, check-ins and weekly goals roll over
    at the user's own midnight. Clients send this on sign-in and whenever the zone changes.
    """
    if current.timezone != payload.timezone:
        current.timezone = payload.timezone
        db.commit()
    return UserTimezonePublic(timezone=payload.timezone)
