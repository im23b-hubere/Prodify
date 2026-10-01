"""add session_area_weights: how a production session's time splits across areas

Revision ID: 0025_session_area_weights
Revises: 0024_skill_focus_primary
Create Date: 2026-10-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025_session_area_weights"
down_revision: Union[str, None] = "0024_skill_focus_primary"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "session_area_weights",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("branch", sa.String(length=32), nullable=False),
        sa.Column("weight", sa.Integer(), nullable=False),
        sa.UniqueConstraint("session_id", "branch", name="uq_session_area_weight"),
    )
    op.create_index("ix_session_area_weights_session_id", "session_area_weights", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_session_area_weights_session_id", table_name="session_area_weights")
    op.drop_table("session_area_weights")
