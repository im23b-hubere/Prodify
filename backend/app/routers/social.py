from fastapi import APIRouter

from app.routers.social_accountability import router as social_accountability_router
from app.routers.social_challenges import router as social_challenges_router
from app.routers.social_commitments import router as social_commitments_router
from app.routers.social_feed import router as social_feed_router
from app.routers.social_insights import router as social_insights_router
from app.routers.social_streak import router as social_streak_router


router = APIRouter(prefix="/social", tags=["social"])
router.include_router(social_accountability_router)
router.include_router(social_challenges_router)
router.include_router(social_commitments_router)
router.include_router(social_feed_router)
router.include_router(social_insights_router)
router.include_router(social_streak_router)
