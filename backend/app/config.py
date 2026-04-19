from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    database_url: str = "sqlite:///./prodify.db"
    cors_origins: list[str] = ["http://localhost:8081", "http://127.0.0.1:8081", "http://localhost:19006"]
    # Optional: Expo push (https://expo.dev/accounts/[account]/settings/access-tokens)
    expo_access_token: str | None = None
    # Optional: FCM HTTP v1 — JSON string of Firebase service account, or filesystem path
    firebase_service_account_json: str | None = None
    firebase_service_account_path: str | None = None
    # Optional: protect POST /jobs/* (cron / GitHub Actions); CLI job ignores this
    internal_job_key: str | None = None

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long.")
        if normalized.lower() in {"change-me", "changeme", "dev-secret-change-in-production"}:
            raise ValueError("SECRET_KEY uses an insecure placeholder value.")
        return normalized


settings = Settings()
