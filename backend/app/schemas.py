import json
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import FriendshipStatus, SessionType


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    username: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SessionStart(BaseModel):
    session_type: SessionType
    notes: str | None = Field(default=None, max_length=200)
    mood_level: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, v: object) -> list[str] | None:
        if v is None:
            return None
        if not isinstance(v, list):
            raise ValueError("tags must be a list of strings")
        out: list[str] = []
        for item in v[:20]:
            s = str(item).strip()
            if not s:
                continue
            if len(s) > 32:
                raise ValueError("each tag must be at most 32 characters")
            out.append(s)
        return out or None


class SessionStop(BaseModel):
    session_id: int


class SessionUpdate(BaseModel):
    session_type: SessionType | None = None
    notes: str | None = Field(default=None, max_length=2000)
    mood_level: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, v: object) -> list[str] | None:
        if v is None:
            return None
        if not isinstance(v, list):
            raise ValueError("tags must be a list of strings")
        out: list[str] = []
        for item in v[:20]:
            s = str(item).strip()
            if not s:
                continue
            if len(s) > 32:
                raise ValueError("each tag must be at most 32 characters")
            out.append(s)
        return out or None


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

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags_json(cls, v: object) -> list[str] | None:
        if v is None or v == "":
            return None
        if isinstance(v, list):
            return [str(x) for x in v]
        if isinstance(v, str):
            try:
                data = json.loads(v)
                if isinstance(data, list):
                    return [str(x) for x in data]
            except json.JSONDecodeError:
                return None
        return None


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


class SessionStatsPublic(BaseModel):
    period: str
    summary: SessionStatsSummary
    trend: list[SessionStatsTrendPoint]
    breakdown: list[SessionStatsTypeBreakdownItem]
    recent_sessions: list[SessionPublic] = Field(default_factory=list)
    productivity_hint: str | None = None


class FriendshipPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    friend_id: int
    status: FriendshipStatus
    created_at: datetime


class StreakPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    current_streak: int
    longest_streak: int
    last_session_date: datetime | None
