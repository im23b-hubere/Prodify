"""add partial unique index for active sessions

Revision ID: 0007_active_session_unique_index
Revises: 0006_streak_reminder_dispatch_log
Create Date: 2026-04-19 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0007_active_session_unique_index"
down_revision: Union[str, None] = "0006_streak_reminder_dispatch_log"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "postgresql":
        op.create_index(
            "idx_one_active_session_per_user",
            "sessions",
            ["user_id"],
            unique=True,
            postgresql_where=sa.text("stopped_at IS NULL AND deleted_at IS NULL"),
        )
    else:
        op.create_index(
            "idx_one_active_session_per_user",
            "sessions",
            ["user_id"],
            unique=True,
            sqlite_where=sa.text("stopped_at IS NULL AND deleted_at IS NULL"),
        )


def downgrade() -> None:
    op.drop_index("idx_one_active_session_per_user", table_name="sessions")
