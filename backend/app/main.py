from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.config import is_sqlite_database_url, settings
from app.database import engine
from app.errors import APIError, api_error_handler, http_exception_handler
from app.middleware.security import SecurityHeadersMiddleware
from app.observability import init_observability
from app.rate_limit import limiter
from app.startup.schema_validation import validate_alembic_head_matches, validate_schema

init_observability()
from app.routers import (
    achievements as achievements_router,
    auth,
    billing as billing_router,
    challenges as challenges_router,
    feature_flags as feature_flags_router,
    friends,
    goals as goals_router,
    jobs as jobs_router,
    legal as legal_router,
    motivation,
    outcomes as outcomes_router,
    notifications as notifications_router,
    progression as progression_router,
    social as social_router,
    sessions,
    stats as stats_router,
    streak,
    users as users_router,
)

logger = logging.getLogger(__name__)


def validate_runtime_config() -> None:
    required_values = {
        "DATABASE_URL": settings.database_url,
        "SECRET_KEY": settings.secret_key,
        "WEBHOOK_SECRET": settings.webhook_secret,
    }

    missing = [name for name, value in required_values.items() if not str(value or "").strip()]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

    if settings.environment == "production":
        normalized_secret = settings.secret_key.strip()
        if normalized_secret == "change_me_in_production":
            raise RuntimeError("SECRET_KEY must be changed in production.")
        if len(normalized_secret) < 32:
            raise RuntimeError("SECRET_KEY must be at least 32 characters in production.")
        if is_sqlite_database_url(settings.database_url):
            raise RuntimeError(
                "DATABASE_URL uses SQLite with ENVIRONMENT=production. "
                "Use PostgreSQL (or another server database) for production deployments."
            )

    logger.info("Configuration validated for environment=%s", settings.environment)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    validate_runtime_config()
    validate_schema()
    validate_alembic_head_matches()
    yield


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(APIError, api_error_handler)
app.add_exception_handler(HTTPException, http_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)

UPLOADS_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
# Local/dev static serving. For production scale-out, prefer object storage + CDN and keep this mount for dev only.
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(auth.router)
app.include_router(feature_flags_router.router)
app.include_router(sessions.router)
app.include_router(streak.router)
app.include_router(friends.router)
app.include_router(users_router.router)
app.include_router(stats_router.router)
app.include_router(motivation.router)
app.include_router(notifications_router.router)
app.include_router(goals_router.router)
app.include_router(achievements_router.router)
app.include_router(jobs_router.router)
app.include_router(legal_router.router)
app.include_router(billing_router.router)
app.include_router(outcomes_router.router)
app.include_router(progression_router.router)
app.include_router(challenges_router.router)
app.include_router(social_router.router)


@app.get("/health")
def health():
    ready = database_is_ready()
    return {
        "status": "ok" if ready else "degraded",
        "environment": settings.environment,
        "version": settings.app_version,
        "checks": {"database": "ok" if ready else "error"},
    }


@app.get("/health/live")
def health_live():
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready():
    if not database_is_ready():
        raise HTTPException(status_code=503, detail="Database is not ready")
    return {"status": "ok", "checks": {"database": "ok"}}


def database_is_ready() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        logger.exception("Database readiness check failed")
        return False
