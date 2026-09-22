"""Config validation for production object storage requirements."""

import pytest
from pydantic import ValidationError

from app.config import Settings


def _production_kwargs(**overrides) -> dict:
    base = {
        "secret_key": "production-secret-key-at-least-32-characters-long",
        "webhook_secret": "production-webhook-secret-at-least-32-chars",
        "internal_job_key": "production-internal-job-key-24",
        "environment": "production",
        "cors_origins": ["https://prodify.app"],
        "database_url": "postgresql+psycopg://user:pass@localhost:5432/prodify",
        "object_storage_endpoint_url": "https://abc123.r2.cloudflarestorage.com",
        "object_storage_access_key_id": "access-key",
        "object_storage_secret_access_key": "secret-key",
        "object_storage_bucket": "prodify-media",
        "object_storage_public_base_url": "https://media.prodify.app/",
    }
    base.update(overrides)
    return base


def test_production_requires_object_storage() -> None:
    with pytest.raises(ValidationError, match="Object storage is required"):
        Settings(
            _env_file=None,
            **_production_kwargs(
                object_storage_endpoint_url=None,
                object_storage_access_key_id=None,
                object_storage_secret_access_key=None,
                object_storage_bucket=None,
                object_storage_public_base_url=None,
            ),
        )


def test_production_rejects_non_https_public_base_url() -> None:
    with pytest.raises(ValidationError, match="https://"):
        Settings(
            _env_file=None,
            **_production_kwargs(object_storage_public_base_url="http://media.prodify.app"),
        )


def test_production_accepts_configured_object_storage() -> None:
    settings = Settings(_env_file=None, **_production_kwargs())
    assert settings.object_storage_public_base_url == "https://media.prodify.app"
