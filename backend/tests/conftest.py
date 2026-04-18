import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_suite.db")
os.environ.setdefault("CORS_ORIGINS", '["http://localhost:8081"]')

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client
