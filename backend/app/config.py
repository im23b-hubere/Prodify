from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    database_url: str = "sqlite:///./beattrack.db"
    cors_origins: list[str] = ["http://localhost:8081", "http://127.0.0.1:8081", "http://localhost:19006"]

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
