"""add session_skill_focuses.assigned_seconds for post-session focus time

Revision ID: 0027_session_focus_assigned_seconds
Revises: 0026_session_still_there
Create Date: 2026-10-07
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0027_session_focus_assigned_seconds"
down_revision: Union[str, None] = "0026_session_still_there"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("session_skill_focuses") as batch:
        batch.add_column(sa.Column("assigned_seconds", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("session_skill_focuses") as batch:
        batch.drop_column("assigned_seconds")
