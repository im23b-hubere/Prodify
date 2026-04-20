from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Prodify API"
    app_version: str = "1.0.0"
    api_version: str = "v1"

    secret_key: str
    algorithm: str = "HS256"
    # Short-lived access JWT; mobile uses refresh tokens for renewal.
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14
    # SQLite for local/dev; for production under load use PostgreSQL (see .env.example).
    database_url: str = "sqlite:///./prodify.db"
    # Pool settings apply when DATABASE_URL is not SQLite (e.g. postgresql+psycopg://...).
    database_pool_size: int = 5
    database_max_overflow: int = 10
    database_pool_pre_ping: bool = True
    database_pool_recycle_seconds: int = 1800
    # Browser origins for CORS; in production use explicit https origins (no "*").
    cors_origins: list[str] = ["http://localhost:8081", "http://127.0.0.1:8081", "http://localhost:19006"]

    environment: Literal["development", "production"] = "development"
    rate_limit_auth_login: str = "10/minute"
    rate_limit_auth_register: str = "5/minute"
    # Optional: Expo push (https://expo.dev/accounts/[account]/settings/access-tokens)
    expo_access_token: str | None = None
    # Optional: FCM HTTP v1 — JSON string of Firebase service account, or filesystem path
    firebase_service_account_json: str | None = None
    firebase_service_account_path: str | None = None
    # Optional: protect POST /jobs/* (cron / GitHub Actions); CLI job ignores this
    internal_job_key: str | None = None
    # Emit application logs as JSON lines to stdout (good for containers / log drains).
    log_json: bool = False
    # Optional: https://sentry.io — API errors, 5xx, slow transactions (when traces_sample_rate > 0).
    sentry_dsn: str | None = None
    # RevenueCat integration (optional in dev).
    revenuecat_secret_key: str | None = None
    revenuecat_webhook_auth: str | None = None
    webhook_secret: str = "change_me_in_production"
    revenuecat_default_offering: str = "default"
    premium_entitlement_name: str = "premium"

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long.")
        if normalized.lower() in {"change-me", "changeme", "dev-secret-change-in-production"}:
            raise ValueError("SECRET_KEY uses an insecure placeholder value.")
        return normalized

    @field_validator("cors_origins", mode="before")
    @classmethod
    def strip_cors_origins(cls, value: object) -> object:
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        return value

    @model_validator(mode="after")
    def cors_must_be_explicit_in_production(self):
        if self.environment != "production":
            return self
        if not self.cors_origins:
            raise ValueError("CORS_ORIGINS must be non-empty when ENVIRONMENT=production.")
        for origin in self.cors_origins:
            if origin == "*" or origin.strip() == "*":
                raise ValueError("Wildcard CORS origin '*' is not allowed when ENVIRONMENT=production.")
        return self

    @model_validator(mode="after")
    def validate_webhook_secret(self):
        normalized = self.webhook_secret.strip()
        if self.environment != "production":
            return self
        if not normalized or normalized == "change_me_in_production":
            raise ValueError("WEBHOOK_SECRET must be set and cannot use placeholder value in production.")
        if len(normalized) < 32:
            raise ValueError("WEBHOOK_SECRET must be at least 32 characters long in production.")
        return self


settings = Settings()


def is_sqlite_database_url(database_url: str) -> bool:
    """True for file- or memory-based SQLite (single-writer; fine for dev / small installs)."""
    return database_url.strip().lower().startswith("sqlite")
