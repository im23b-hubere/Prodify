"""mark one skill focus per session as the main focus

Revision ID: 0024_skill_focus_primary
Revises: 0023_session_skill_focuses
Create Date: 2026-09-30
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024_skill_focus_primary"
down_revision: Union[str, None] = "0023_session_skill_focuses"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("session_skill_focuses") as batch:
        batch.add_column(
            sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false())
        )


def downgrade() -> None:
    with op.batch_alter_table("session_skill_focuses") as batch:
        batch.drop_column("is_primary")
