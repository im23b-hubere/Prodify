from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.timeutil import MAX_TIMEZONE_LENGTH, is_supported_timezone


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


class PasswordResetRequest(BaseModel):
    email: EmailStr
    # The app's language (e.g. "de-CH"), so the code arrives in words the user reads.
    locale: str | None = Field(default=None, max_length=35)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\s*\d{6}\s*$")
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("code")
    @classmethod
    def strip_code(cls, value: str) -> str:
        return value.strip()


class AppleSignIn(BaseModel):
    identity_token: str = Field(min_length=20, max_length=8192)
    # One-time code from the device; exchanged for an Apple refresh token so deletion can revoke it.
    authorization_code: str | None = Field(default=None, max_length=1024)
    # Apple only reveals the name on the very first authorization, so the app forwards it.
    given_name: str | None = Field(default=None, max_length=64)


class GoogleSignIn(BaseModel):
    id_token: str = Field(min_length=20, max_length=8192)


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
    timezone: str | None = None


class UserTimezoneUpdate(BaseModel):
    """Device-reported IANA zone; rejected outright if this server's tz database lacks it."""

    timezone: str = Field(min_length=1, max_length=MAX_TIMEZONE_LENGTH)

    @field_validator("timezone")
    @classmethod
    def must_be_known_iana_zone(cls, value: str) -> str:
        normalized = value.strip()
        if not is_supported_timezone(normalized):
            raise ValueError("unknown IANA timezone identifier")
        return normalized


class UserTimezonePublic(BaseModel):
    timezone: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=8, max_length=4096)
