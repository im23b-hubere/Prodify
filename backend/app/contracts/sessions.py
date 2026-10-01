import json
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import SessionType
from app.skill_catalog import (
    AREA_WEIGHTS,
    MAX_PLANNED_FOCUSES_PER_SESSION,
    SKILL_BRANCHES,
    SKILL_FOCUS_IDS,
    incompatible_focus_ids,
    normalize_focus_ids,
)

MAX_SUGGESTED_FOCUSES = 2


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
    skill_focus_ids: list[str] = Field(default_factory=list)
    # Only measured, never stored on the session, so unknown ids are dropped instead of rejected.
    suggested_skill_focus_ids: list[str] = Field(default_factory=list)

    @field_validator("notes")
    @classmethod
    def sanitize_notes(cls, value: str | None) -> str | None:
        return _clean_optional_text(value)

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, value: object) -> list[str] | None:
        return _normalize_tags(value)

    @field_validator("skill_focus_ids", mode="before")
    @classmethod
    def normalize_skill_focus_ids(cls, value: object) -> list[str]:
        if value is None:
            return []
        return normalize_focus_ids(value, max_count=MAX_PLANNED_FOCUSES_PER_SESSION)

    @field_validator("suggested_skill_focus_ids", mode="before")
    @classmethod
    def keep_known_suggestions(cls, value: object) -> list[str]:
        if not isinstance(value, list):
            return []
        known = (str(item).strip() for item in value)
        return list(dict.fromkeys(item for item in known if item in SKILL_FOCUS_IDS))[
            :MAX_SUGGESTED_FOCUSES
        ]

    @model_validator(mode="after")
    def require_focuses_matching_session_type(self) -> "SessionStart":
        mismatched = incompatible_focus_ids(self.skill_focus_ids, self.session_type.value)
        if mismatched:
            raise ValueError(
                f"skill focuses {', '.join(mismatched)} do not belong to session type "
                f"{self.session_type.value}"
            )
        return self


class SessionStop(BaseModel):
    session_id: int = Field(gt=0)


class AreaWeight(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    branch: str
    weight: int

    @field_validator("branch")
    @classmethod
    def require_known_area(cls, value: str) -> str:
        if value not in SKILL_BRANCHES:
            raise ValueError(f"unknown area {value}")
        return value

    @field_validator("weight")
    @classmethod
    def require_known_weight(cls, value: int) -> int:
        if value not in AREA_WEIGHTS:
            raise ValueError(f"area weight must be one of {', '.join(map(str, AREA_WEIGHTS))}")
        return value


class SessionUpdate(BaseModel):
    session_type: SessionType | None = None
    notes: str | None = Field(default=None, max_length=2000)
    mood_level: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] | None = None
    track_outcome: Literal["none", "wip", "finished"] | None = None
    track_title: str | None = Field(default=None, max_length=160)
    # Compatibility with the (possibly updated) session type, the running-session limit and the
    # main focus are checked in the service, because the stored session is only known there.
    skill_focus_ids: list[str] | None = None
    primary_skill_focus_id: str | None = None
    area_weights: list[AreaWeight] | None = None

    @field_validator("notes")
    @classmethod
    def sanitize_notes(cls, value: str | None) -> str | None:
        return _clean_optional_text(value)

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, value: object) -> list[str] | None:
        return _normalize_tags(value)

    @field_validator("skill_focus_ids", mode="before")
    @classmethod
    def normalize_skill_focus_ids(cls, value: object) -> list[str]:
        return [] if value is None else normalize_focus_ids(value)

    @field_validator("area_weights")
    @classmethod
    def require_each_area_once(cls, value: list[AreaWeight] | None) -> list[AreaWeight] | None:
        branches = [item.branch for item in value or []]
        if len(branches) != len(set(branches)):
            raise ValueError("each area may be weighted only once")
        return value

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
    skill_focus_ids: list[str] = Field(default_factory=list)
    primary_skill_focus_id: str | None = None
    area_weights: list[AreaWeight] = Field(default_factory=list)

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


class SkillProgressPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    skill_id: str
    gained_seconds: int
    total_seconds: int
    level: int
    previous_level: int
    level_start_seconds: int
    next_level_seconds: int | None


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
