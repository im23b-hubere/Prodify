from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        normalized = value.strip().lower()
        if len(normalized) < 2:
            raise ValueError("username must contain at least 2 characters")
        return normalized


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class UserPublic(BaseModel):
    """Friend-visible fields that never expose account email."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    profile_picture_url: str | None = None
    is_premium: bool = False
    created_at: datetime


class UserAccountPublic(BaseModel):
    """Authenticated account view for the signed-in user."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    username: str
    profile_picture_url: str | None = None
    is_premium: bool = False
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=8, max_length=4096)
