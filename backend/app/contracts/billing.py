from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Prodify has no free tier: "inactive" means no paid access, which leads to the paywall.
Entitlement = Literal["inactive", "premium"]


class EntitlementPublic(BaseModel):
    provider: str = "revenuecat"
    entitlement: Entitlement = "inactive"
    trial_active: bool = False
    expires_at: datetime | None = None


class BillingSyncBody(BaseModel):
    app_user_id: str = Field(min_length=1, max_length=255)
    entitlement: Entitlement = "inactive"
    trial_active: bool = False
    expires_at: datetime | None = None

    @field_validator("app_user_id")
    @classmethod
    def sanitize_app_user_id(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("app_user_id must not be empty")
        return cleaned

    @field_validator("entitlement", mode="before")
    @classmethod
    def accept_legacy_free_value(cls, value: object) -> object:
        # App builds released before the rename still send "free".
        return "inactive" if value == "free" else value
