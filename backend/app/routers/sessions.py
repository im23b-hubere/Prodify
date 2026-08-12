from fastapi import APIRouter

from app.routers.session_insights import router as insights_router
from app.routers.session_lifecycle import router as lifecycle_router
from app.routers.session_records import router as records_router
from app.routers.session_stats import router as stats_router

router = APIRouter(prefix="/sessions", tags=["sessions"])
router.include_router(lifecycle_router)
router.include_router(records_router)
router.include_router(insights_router)
router.include_router(stats_router)
