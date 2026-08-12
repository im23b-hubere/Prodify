from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class EntitlementPublic(BaseModel):
    provider: str = "revenuecat"
    entitlement: Literal["free", "premium"] = "free"
    trial_active: bool = False
    expires_at: datetime | None = None


class BillingSyncBody(BaseModel):
    app_user_id: str = Field(min_length=1, max_length=255)
    entitlement: Literal["free", "premium"] = "free"
    trial_active: bool = False
    expires_at: datetime | None = None

    @field_validator("app_user_id")
    @classmethod
    def sanitize_app_user_id(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("app_user_id must not be empty")
        return cleaned
