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
    sentry_traces_sample_rate: float = 0.15
    # RevenueCat integration (optional in dev).
    revenuecat_secret_key: str | None = None
    revenuecat_webhook_auth: str | None = None
    webhook_secret: str = "change_me_in_production"
    revenuecat_default_offering: str = "default"
    premium_entitlement_name: str = "app_access"
    # Optional emergency fallback trial before RevenueCat rows exist: grant access for N days after signup.
    # Keep at 0 for strict paid-access behavior (recommended for production).
    onboarding_trial_days: int = 0
    legal_privacy_url: str = "https://prodify.app/privacy"
    legal_terms_url: str = "https://prodify.app/terms"
    legal_effective_date: str = "2026-04-20"
    legal_version: str = "2026.04"
    support_email: str = "support@prodify.app"
    feature_flag_billing_sync_enabled: bool = True
    feature_flag_push_notifications_enabled: bool = True
    feature_flag_smart_nudges_enabled: bool = True
    # Local Ollama text generation for premium coaching surfaces (optional).
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.1:8b"
    ollama_timeout_seconds: float = 20.0
    # Comma-separated user IDs allowed to read internal KPI endpoints.
    kpi_admin_user_ids: list[int] = []
    # Comma-separated trusted reverse-proxy IPs/CIDRs for x-forwarded-for.
    trusted_proxy_ips: list[str] = []
    # Push async dispatch backend:
    # - threadpool: bounded in-process worker pool (default)
    # - inline: execute in request process (debug/fallback)
    # - arq: reserved for external queue rollout; currently falls back to threadpool with warning
    push_async_backend: Literal["threadpool", "inline", "arq"] = "threadpool"
    push_async_max_workers: int = 4
    # Startup schema validation behavior:
    # - strict (default): fail-fast on schema drift / alembic head mismatch.
    # - non-strict: warn for column/head mismatches to support rolling deploy windows.
    startup_schema_strict: bool = True

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

    @field_validator("kpi_admin_user_ids", mode="before")
    @classmethod
    def parse_kpi_admin_user_ids(cls, value: object) -> object:
        if value is None:
            return []
        if isinstance(value, str):
            if not value.strip():
                return []
            return [int(part.strip()) for part in value.split(",") if part.strip()]
        return value

    @field_validator("trusted_proxy_ips", mode="before")
    @classmethod
    def parse_trusted_proxy_ips(cls, value: object) -> object:
        if value is None:
            return []
        if isinstance(value, str):
            if not value.strip():
                return []
            return [part.strip() for part in value.split(",") if part.strip()]
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

    @model_validator(mode="after")
    def validate_sentry_in_production(self):
        if self.environment != "production":
            return self
        dsn = (self.sentry_dsn or "").strip()
        if not dsn:
            raise ValueError("SENTRY_DSN must be set when ENVIRONMENT=production.")
        return self

    @model_validator(mode="after")
    def validate_internal_job_key_in_production(self):
        if self.environment != "production":
            return self
        key = (self.internal_job_key or "").strip()
        if len(key) < 24:
            raise ValueError(
                "INTERNAL_JOB_KEY must be set to a strong secret (24+ characters) when ENVIRONMENT=production."
            )
        return self


settings = Settings()


def feature_flags_snapshot() -> dict[str, bool]:
    return {
        "billing_sync_enabled": bool(settings.feature_flag_billing_sync_enabled),
        "push_notifications_enabled": bool(settings.feature_flag_push_notifications_enabled),
        "smart_nudges_enabled": bool(settings.feature_flag_smart_nudges_enabled),
    }


def is_sqlite_database_url(database_url: str) -> bool:
    """True for file- or memory-based SQLite (single-writer; fine for dev / small installs)."""
    return database_url.strip().lower().startswith("sqlite")


def normalize_database_url(database_url: str) -> str:
    """
    Normalize DB URLs for SQLAlchemy driver compatibility.

    Render and other hosts commonly provide `postgres://...` or `postgresql://...`.
    This app uses psycopg v3, so we normalize to `postgresql+psycopg://...` to avoid
    SQLAlchemy attempting psycopg2 imports.
    """
    raw = database_url.strip()
    lower = raw.lower()
    if lower.startswith("postgresql+psycopg://"):
        return raw
    if lower.startswith("postgres://"):
        return "postgresql+psycopg://" + raw[len("postgres://") :]
    if lower.startswith("postgresql://"):
        return "postgresql+psycopg://" + raw[len("postgresql://") :]
    return raw
