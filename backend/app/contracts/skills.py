from datetime import datetime

from pydantic import BaseModel


class SkillNodePublic(BaseModel):
    total_seconds: int
    level: int
    level_start_seconds: int
    next_level_seconds: int | None
    session_count: int
    last_trained_at: datetime | None


class BranchSkillPublic(SkillNodePublic):
    branch: str


class FocusSkillPublic(SkillNodePublic):
    skill_id: str
    branch: str


class SkillProfilePublic(BaseModel):
    total_seconds: int
    branches: list[BranchSkillPublic]
    focuses: list[FocusSkillPublic]
