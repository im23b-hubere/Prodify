from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import is_sqlite_database_url, normalize_database_url, settings


def _create_engine():
    url = normalize_database_url(settings.database_url)
    if is_sqlite_database_url(url):
        # Single-file SQLite: one writer at a time; check_same_thread allows FastAPI threadpool.
        return create_engine(url, connect_args={"check_same_thread": False})

    # PostgreSQL and other servers: pooled connections for concurrent requests and workers.
    return create_engine(
        url,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        pool_pre_ping=settings.database_pool_pre_ping,
        pool_recycle=settings.database_pool_recycle_seconds,
    )


engine = _create_engine()

if is_sqlite_database_url(settings.database_url):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
