"""Compose user endpoint groups under their public API prefix."""

from fastapi import APIRouter

from app.routers.user_account import router as account_router
from app.routers.user_profile_media import router as profile_media_router
from app.routers.user_public_profiles import router as public_profiles_router
from app.services.profile_picture_service import PROFILE_UPLOAD_DIR

router = APIRouter(prefix="/users", tags=["users"])
router.include_router(account_router)
router.include_router(profile_media_router)
router.include_router(public_profiles_router)
