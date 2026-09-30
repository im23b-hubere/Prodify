"""add session_skill_focuses for skill-tree progress tracking

Revision ID: 0023_session_skill_focuses
Revises: 0022_user_timezone
Create Date: 2026-09-30
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023_session_skill_focuses"
down_revision: Union[str, None] = "0022_user_timezone"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "session_skill_focuses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("skill_id", sa.String(length=64), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False, server_default="planned"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("session_id", "skill_id", name="uq_session_skill_focus"),
    )
    op.create_index(
        "ix_session_skill_focuses_session_id", "session_skill_focuses", ["session_id"]
    )
    op.create_index("ix_session_skill_focuses_skill_id", "session_skill_focuses", ["skill_id"])


def downgrade() -> None:
    op.drop_index("ix_session_skill_focuses_skill_id", table_name="session_skill_focuses")
    op.drop_index("ix_session_skill_focuses_session_id", table_name="session_skill_focuses")
    op.drop_table("session_skill_focuses")
