import json
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import SessionType


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(value.strip().split())
    return cleaned or None


def _normalize_tags(value: object) -> list[str] | None:
    if value is None:
        return None
    if not isinstance(value, list):
        raise ValueError("tags must be a list of strings")

    normalized: list[str] = []
    for item in value[:20]:
        tag = str(item).strip()
        if not tag:
            continue
        if len(tag) > 32:
            raise ValueError("each tag must be at most 32 characters")
        normalized.append(tag)
    return normalized or None


class SessionQuickStart(BaseModel):
    session_type: SessionType = SessionType.beat_making


class SessionStart(BaseModel):
    session_type: SessionType
    notes: str | None = Field(default=None, max_length=200)
    mood_level: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] | None = None

    @field_validator("notes")
    @classmethod
    def sanitize_notes(cls, value: str | None) -> str | None:
        return _clean_optional_text(value)

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, value: object) -> list[str] | None:
        return _normalize_tags(value)


class SessionStop(BaseModel):
    session_id: int = Field(gt=0)


class SessionUpdate(BaseModel):
    session_type: SessionType | None = None
    notes: str | None = Field(default=None, max_length=2000)
    mood_level: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] | None = None
    track_outcome: Literal["none", "wip", "finished"] | None = None
    track_title: str | None = Field(default=None, max_length=160)

    @field_validator("notes")
    @classmethod
    def sanitize_notes(cls, value: str | None) -> str | None:
        return _clean_optional_text(value)

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, value: object) -> list[str] | None:
        return _normalize_tags(value)

    @field_validator("track_title")
    @classmethod
    def sanitize_track_title(cls, value: str | None) -> str | None:
        return _clean_optional_text(value)


class SessionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    started_at: datetime
    stopped_at: datetime | None
    duration_seconds: int | None
    session_type: str
    notes: str | None
    mood_level: int | None = None
    tags: list[str] | None = None
    paused_duration_seconds: int = 0
    pause_started_at: datetime | None = None
    focus_score: int | None = None
    track_outcome: Literal["none", "wip", "finished"] | None = None
    track_title: str | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags_json(cls, value: object) -> list[str] | None:
        if value is None or value == "":
            return None
        if isinstance(value, list):
            return [str(item) for item in value]
        if not isinstance(value, str):
            return None
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return None
        return [str(item) for item in parsed] if isinstance(parsed, list) else None


class SessionStatsSummary(BaseModel):
    total_seconds: int
    total_sessions: int
    best_streak_days: int
    avg_session_seconds: int
    current_streak_days: int = 0
    hours_delta_vs_prior_period: float | None = None


class SessionStatsTrendPoint(BaseModel):
    label: str
    sessions: int
    seconds: int


class SessionStatsTypeBreakdownItem(BaseModel):
    session_type: str
    sessions: int
    percent: float


class InsightItemPublic(BaseModel):
    """Stable key and parameters for client-side localization."""

    key: str
    params: dict[str, int | float | str] = Field(default_factory=dict)


class SessionStatsPublic(BaseModel):
    period: str
    summary: SessionStatsSummary
    trend: list[SessionStatsTrendPoint]
    breakdown: list[SessionStatsTypeBreakdownItem]
    recent_sessions: list[SessionPublic] = Field(default_factory=list)
    productivity_hint: str | None = None
    productivity_hint_item: InsightItemPublic | None = None
