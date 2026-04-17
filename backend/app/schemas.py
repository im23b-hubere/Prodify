from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

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
    session_type: SessionType | None = None
    notes: str | None = Field(default=None, max_length=2000)


class SessionStop(BaseModel):
    session_id: int


class SessionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    started_at: datetime
    stopped_at: datetime | None
    duration_seconds: int | None
    session_type: SessionType
    notes: str | None


class SessionStatsSummary(BaseModel):
    total_seconds: int
    total_sessions: int
    best_streak_days: int


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
