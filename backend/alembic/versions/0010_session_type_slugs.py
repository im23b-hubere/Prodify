"""Normalize session_type values to slug ids

Revision ID: 0010_session_type_slugs
Revises: 0009_refresh_tokens
Create Date: 2026-04-19 12:00:00
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0010_session_type_slugs"
down_revision: Union[str, None] = "0009_refresh_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UPGRADE_MAP = (
    ("Beat Making", "beat_making"),
    ("Mixing", "mixing"),
    ("Sound Design", "sound_design"),
)


def upgrade() -> None:
    conn = op.get_bind()
    for old, new in _UPGRADE_MAP:
        conn.execute(
            text("UPDATE sessions SET session_type = :new WHERE session_type = :old"),
            {"new": new, "old": old},
        )


def downgrade() -> None:
    conn = op.get_bind()
    for old, new in _UPGRADE_MAP:
        conn.execute(
            text("UPDATE sessions SET session_type = :old WHERE session_type = :new"),
            {"new": new, "old": old},
        )
