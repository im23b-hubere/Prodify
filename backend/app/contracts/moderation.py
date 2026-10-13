from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

ReportReason = Literal["spam", "harassment", "hate", "sexual", "other"]
ReportStatus = Literal["open", "resolved"]


class ReportCreate(BaseModel):
    target_type: Literal["user", "comment"]
    user_id: int | None = None
    comment_id: int | None = None
    reason: ReportReason
    note: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def require_target_id(self) -> "ReportCreate":
        target_id = self.user_id if self.target_type == "user" else self.comment_id
        if target_id is None:
            raise ValueError(f"{self.target_type}_id is required for target_type '{self.target_type}'")
        return self


class ReportCreated(BaseModel):
    id: int


class ContentReportPublic(BaseModel):
    id: int
    target_type: str
    comment_id: int | None
    content_snapshot: str
    reason: str
    note: str | None
    status: str
    created_at: datetime
    resolved_at: datetime | None
    reporter_id: int | None
    reporter_username: str | None
    reported_user_id: int
    reported_username: str
    reported_user_is_suspended: bool
