from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.contracts.skills import BranchSkillPublic, FocusSkillPublic, SkillProfilePublic
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services.skill_profile_service import SkillNode, build_skill_profile
from app.skill_catalog import branch_of_focus

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("/profile", response_model=SkillProfilePublic)
def get_skill_profile(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    profile = build_skill_profile(db, current.id)
    return SkillProfilePublic(
        total_seconds=profile.total_seconds,
        branches=[
            BranchSkillPublic(branch=branch, **_node_fields(node))
            for branch, node in profile.branches.items()
        ],
        focuses=[
            FocusSkillPublic(skill_id=focus_id, branch=branch_of_focus(focus_id), **_node_fields(node))
            for focus_id, node in profile.focuses.items()
        ],
    )


def _node_fields(node: SkillNode) -> dict:
    return {
        "total_seconds": node.total_seconds,
        "level": node.level.level,
        "level_start_seconds": node.level.level_start_seconds,
        "next_level_seconds": node.level.next_level_seconds,
        "session_count": node.session_count,
        "last_trained_at": node.last_trained_at,
    }
