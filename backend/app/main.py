from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect

from app.config import settings
from app.database import engine
from app.routers import (
    achievements as achievements_router,
    auth,
    friends,
    goals as goals_router,
    jobs as jobs_router,
    motivation,
    notifications as notifications_router,
    sessions,
    stats as stats_router,
    streak,
    users as users_router,
)


def validate_schema() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    required_tables = {
        "users",
        "sessions",
        "streaks",
        "friendships",
        "push_tokens",
        "user_goals",
        "user_achievements",
        "streak_reminder_dispatch_log",
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


@asynccontextmanager
async def lifespan(_app: FastAPI):
    validate_schema()
    yield


app = FastAPI(title="Prodify API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
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


@app.get("/health")
def health():
    return {"status": "ok"}
