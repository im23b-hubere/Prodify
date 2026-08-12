"""Compose friend-related endpoint groups under their public API prefix."""

from fastapi import APIRouter

from app.routers.friend_activity import router as activity_router
from app.routers.friend_leaderboard import router as leaderboard_router
from app.routers.friend_relationships import router as relationships_router

router = APIRouter(prefix="/friends", tags=["friends"])

# Static routes must precede the friendship-id routes to avoid ambiguous matches.
router.include_router(leaderboard_router)
router.include_router(activity_router)
router.include_router(relationships_router)
