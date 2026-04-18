"""session mood tags pause

Revision ID: 0002_session_mood_tags_pause
Revises: 0001_initial_schema
Create Date: 2026-04-18 00:00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_session_mood_tags_pause"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("mood_level", sa.Integer(), nullable=True))
    op.add_column("sessions", sa.Column("tags", sa.String(length=1024), nullable=True))
    op.add_column(
        "sessions",
        sa.Column("paused_duration_seconds", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("sessions", sa.Column("pause_started_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("sessions", "pause_started_at")
    op.drop_column("sessions", "paused_duration_seconds")
    op.drop_column("sessions", "tags")
    op.drop_column("sessions", "mood_level")
