from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.database import Base, engine
from app.routers import auth, sessions


def ensure_session_type_column() -> None:
    inspector = inspect(engine)
    if "sessions" not in inspector.get_table_names():
        return
    column_names = {column["name"] for column in inspector.get_columns("sessions")}
    if "session_type" in column_names:
        return
    with engine.begin() as conn:
        conn.execute(
            text("ALTER TABLE sessions ADD COLUMN session_type VARCHAR(64) NOT NULL DEFAULT 'Beat Making'")
        )


def ensure_deleted_at_column() -> None:
    inspector = inspect(engine)
    if "sessions" not in inspector.get_table_names():
        return
    column_names = {column["name"] for column in inspector.get_columns("sessions")}
    if "deleted_at" in column_names:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE sessions ADD COLUMN deleted_at DATETIME NULL"))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_session_type_column()
    ensure_deleted_at_column()
    yield


app = FastAPI(title="BeatTrack API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sessions.router)


@app.get("/health")
def health():
    return {"status": "ok"}
