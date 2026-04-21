from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import inspect, text

from app.config import is_sqlite_database_url, settings
from app.database import engine
from app.errors import APIError, api_error_handler, http_exception_handler
from app.middleware.security import SecurityHeadersMiddleware
from app.observability import init_observability
from app.rate_limit import limiter

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


def validate_schema() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    required_tables = {
        "users",
        "sessions",
        "streaks",
        "friendships",
        "push_tokens",
        "refresh_tokens",
        "user_goals",
        "user_achievements",
        "streak_reminder_dispatch_log",
        "user_subscriptions",
        "user_progression",
        "xp_ledger",
        "growth_events",
        "weekly_review_snapshots",
        "public_goals",
        "weekly_challenges",
        "challenge_participants",
        "weekly_checkins",
        "buddy_relationships",
        "checkin_plans",
        "checkin_logs",
        "social_comments",
        "social_reactions",
        "social_challenges",
        "social_challenge_members",
        "social_commitments",
        "streak_rescues",
        "streak_break_notify_dedupe",
        "analytics_event_dedupe",
    }
    missing_tables = required_tables.difference(table_names)
    if missing_tables:
        missing = ", ".join(sorted(missing_tables))
        raise RuntimeError(f"Database schema is missing required tables: {missing}. Run Alembic migrations.")

    streak_cols = {column["name"] for column in inspector.get_columns("streaks")}
    required_streak = {"frozen_day_keys", "freezes_remaining", "billing_month"}
    missing_streak = required_streak.difference(streak_cols)
    if missing_streak:
        miss = ", ".join(sorted(missing_streak))
        raise RuntimeError(
            f"Database schema is missing columns for 'streaks': {miss}. Run Alembic migrations before starting the API."
        )

    column_names = {column["name"] for column in inspector.get_columns("sessions")}
    required_columns = {
        "session_type",
        "deleted_at",
        "mood_level",
        "tags",
        "paused_duration_seconds",
        "pause_started_at",
        "focus_score",
        "track_outcome",
        "track_title",
    }
    missing_columns = required_columns.difference(column_names)
    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise RuntimeError(
            f"Database schema is missing columns for 'sessions': {missing}. "
            "Run Alembic migrations before starting the API."
        )

    push_cols = {column["name"] for column in inspector.get_columns("push_tokens")}
    if "channel" not in push_cols:
        raise RuntimeError("Database schema is missing column 'channel' on 'push_tokens'. Run Alembic migrations.")
    required_push_cols = {"is_active", "last_used_at"}
    missing_push = required_push_cols.difference(push_cols)
    if missing_push:
        raise RuntimeError(
            f"Database schema is missing columns on 'push_tokens': {', '.join(sorted(missing_push))}. Run Alembic migrations."
        )

    user_cols = {column["name"] for column in inspector.get_columns("users")}
    required_user_cols = {
        "profile_picture_url",
        "is_premium",
        "premium_until",
        "bonus_rescues",
        "bonus_challenge_slots",
        "access_token_version",
    }
    missing_user = required_user_cols.difference(user_cols)
    if missing_user:
        raise RuntimeError(
            f"Database schema is missing columns on 'users': {', '.join(sorted(missing_user))}. Run Alembic migrations."
        )

    # In production with a server DB, refuse to start if migrations were never applied (no revision tracking).
    if settings.environment == "production" and not is_sqlite_database_url(settings.database_url):
        if "alembic_version" not in table_names:
            raise RuntimeError(
                "Production database has no alembic_version table. Apply migrations before starting the API: "
                "alembic upgrade head"
            )


def validate_alembic_head_matches() -> None:
    """When `alembic_version` exists, require it matches the application's migration head (avoids partial migrations)."""
    from pathlib import Path

    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from sqlalchemy import text

    inspector = inspect(engine)
    if "alembic_version" not in inspector.get_table_names():
        return
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    script = ScriptDirectory.from_config(cfg)
    head = script.get_current_head()
    with engine.connect() as conn:
        rev = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).scalar_one_or_none()
    if rev and head and rev != head:
        raise RuntimeError(
            f"Alembic database revision is '{rev}' but code expects '{head}'. Run `alembic upgrade head` before starting."
        )


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
