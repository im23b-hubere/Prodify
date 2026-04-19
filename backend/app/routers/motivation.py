import random
from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models import User
from app.schemas import MotivationalMessagePublic

router = APIRouter(prefix="/motivational-messages", tags=["motivation"])

POOL = [
    "legend",
    "brick",
    "special",
    "grind",
    "consistency",
    "compound",
    "showed_up",
    "mastery",
    "stacking",
    "focus",
]


@router.get("/random", response_model=MotivationalMessagePublic)
def random_message(current: Annotated[User, Depends(get_current_user)]):
    _ = current
    return MotivationalMessagePublic(message_key=random.choice(POOL), variant="rotate")
