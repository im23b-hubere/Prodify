"""Compose user endpoint groups under their public API prefix."""

from fastapi import APIRouter, Depends

from app.dependencies_subscription import require_subscriber
from app.routers.user_account import router as account_router
from app.routers.user_preferences import router as preferences_router
from app.routers.user_profile_media import router as profile_media_router
from app.routers.user_public_profiles import router as public_profiles_router

_subscriber = [Depends(require_subscriber)]

router = APIRouter(prefix="/users", tags=["users"])
router.include_router(account_router)
router.include_router(preferences_router, dependencies=_subscriber)
router.include_router(profile_media_router, dependencies=_subscriber)
router.include_router(public_profiles_router, dependencies=_subscriber)
