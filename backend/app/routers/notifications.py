"""Compose notification endpoint groups under their public API prefix."""

from fastapi import APIRouter

from app.routers.notification_inbox import router as inbox_router
from app.routers.notification_push import router as push_router

router = APIRouter(prefix="/notifications", tags=["notifications"])
router.include_router(inbox_router)
router.include_router(push_router)
