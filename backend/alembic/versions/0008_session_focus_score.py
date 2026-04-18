"""add focus_score to sessions

Revision ID: 0008_session_focus_score
Revises: 0007_active_session_unique_index
Create Date: 2026-04-19 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008_session_focus_score"
down_revision: Union[str, None] = "0007_active_session_unique_index"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("focus_score", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("sessions", "focus_score")
