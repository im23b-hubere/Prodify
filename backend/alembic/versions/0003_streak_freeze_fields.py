"""streak freeze fields

Revision ID: 0003_streak_freeze_fields
Revises: 0002_session_mood_tags_pause
Create Date: 2026-04-18 12:00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_streak_freeze_fields"
down_revision: Union[str, None] = "0002_session_mood_tags_pause"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "streaks",
        sa.Column("frozen_day_keys", sa.Text(), nullable=False, server_default="[]"),
    )
    op.add_column(
        "streaks",
        sa.Column("freezes_remaining", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "streaks",
        sa.Column("billing_month", sa.String(length=7), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("streaks", "billing_month")
    op.drop_column("streaks", "freezes_remaining")
    op.drop_column("streaks", "frozen_day_keys")
