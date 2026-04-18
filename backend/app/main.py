from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect

from app.config import settings
from app.database import engine
from app.routers import auth, sessions


def validate_schema() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    required_tables = {"users", "sessions", "streaks", "friendships"}
    missing_tables = required_tables.difference(table_names)
    if missing_tables:
        missing = ", ".join(sorted(missing_tables))
        raise RuntimeError(f"Database schema is missing required tables: {missing}. Run Alembic migrations.")

    column_names = {column["name"] for column in inspector.get_columns("sessions")}
    required_columns = {"session_type", "deleted_at"}
    missing_columns = required_columns.difference(column_names)
    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise RuntimeError(
            f"Database schema is missing columns for 'sessions': {missing}. "
            "Run Alembic migrations before starting the API."
        )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    validate_schema()
    yield


app = FastAPI(title="BeatTrack API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sessions.router)


@app.get("/health")
def health():
    return {"status": "ok"}
