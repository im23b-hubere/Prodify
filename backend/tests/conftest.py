import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_suite.db")
os.environ.setdefault("CORS_ORIGINS", '["http://localhost:8081"]')
os.environ.setdefault("RATE_LIMIT_AUTH_LOGIN", "1000/minute")
os.environ.setdefault("RATE_LIMIT_AUTH_REGISTER", "1000/minute")
# Unit/integration tests must never call the live RevenueCat API from a developer's
# local .env. In development, an unconfigured secret intentionally exercises the
# deterministic client-asserted billing sync path used by these endpoint tests.
os.environ["ENVIRONMENT"] = "development"
os.environ["REVENUECAT_SECRET_KEY"] = ""

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client
