import random
from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models import User
from app.schemas import MotivationalMessagePublic

router = APIRouter(prefix="/motivational-messages", tags=["motivation"])

POOL = [
    "That's how legends are made! 🔥",
    "Another brick in your empire! 🏗️",
    "You're building something special! ✨",
    "The grind doesn't lie! 💪",
    "Consistency beats talent! 🎯",
    "Studio time is compound interest. 📈",
    "You showed up — that is the whole game. 🎹",
    "One more session closer to mastery. 🏆",
    "Keep stacking wins. 🔁",
    "Focus looks good on you. ✨",
]


@router.get("/random", response_model=MotivationalMessagePublic)
def random_message(current: Annotated[User, Depends(get_current_user)]):
    _ = current
    return MotivationalMessagePublic(message=random.choice(POOL), variant="rotate")
