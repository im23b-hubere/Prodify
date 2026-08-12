from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class PushTokenRegister(BaseModel):
    token: str = Field(min_length=8, max_length=512)
    platform: str = Field(default="unknown", max_length=32)
    channel: Literal["expo", "fcm"] = "expo"

    @field_validator("token")
    @classmethod
    def sanitize_token(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 8:
            raise ValueError("token must contain at least 8 characters")
        return cleaned

    @field_validator("platform")
    @classmethod
    def normalize_platform(cls, value: str) -> str:
        normalized = value.strip().lower()
        allowed = {"ios", "android", "web", "unknown"}
        if normalized not in allowed:
            return "unknown"
        return normalized


class PushPingBody(BaseModel):
    """Select canned copy, with optional overrides for test notifications."""

    template: Literal["test", "session_demo", "streak_demo"] = "test"
    title: str | None = Field(default=None, max_length=64)
    body: str | None = Field(default=None, max_length=200)
    streak_days: int | None = Field(default=None, ge=1, le=999)


class PushBulkResultPublic(BaseModel):
    attempted: int
    delivered_ok: int
    message: str | None = None


class NotificationInboxItemPublic(BaseModel):
    id: str
    category: Literal["streak", "achievement", "social", "tips"]
    priority: Literal["low", "normal", "high", "critical"] = "normal"
    title: str
    body: str
    title_key: str | None = None
    title_params: dict[str, int | float | str] = Field(default_factory=dict)
    body_key: str | None = None
    body_params: dict[str, int | float | str] = Field(default_factory=dict)
    created_at: datetime
    expires_at: datetime | None = None
    read: bool = False
    action_label: str | None = None
    action_route: str | None = None


class NotificationInboxReadBody(BaseModel):
    up_to_ms: int | None = Field(default=None, ge=0)


class SmartNudgeBody(BaseModel):
    kind: Literal["inactivity", "best_time", "forecast_risk"] = "inactivity"
    hour: int | None = Field(default=None, ge=0, le=23)
    remaining_sessions: int | None = Field(default=None, ge=0, le=100)
    days_left: int | None = Field(default=None, ge=0, le=30)
    days_inactive: int | None = Field(default=None, ge=1, le=60)
