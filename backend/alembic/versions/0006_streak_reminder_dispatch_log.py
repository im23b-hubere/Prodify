"""streak_reminder_dispatch_log for server streak push dedupe

Revision ID: 0006_streak_reminder_dispatch
Revises: 0005_push_token_channel
Create Date: 2026-04-18 20:00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_streak_reminder_dispatch"
down_revision: Union[str, None] = "0005_push_token_channel"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "streak_reminder_dispatch_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("utc_day_key", sa.String(length=10), nullable=False),
        sa.Column("slot_kind", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "utc_day_key", "slot_kind", name="uq_streak_reminder_dispatch_slot"),
    )
    op.create_index(
        "ix_streak_reminder_dispatch_log_user_id",
        "streak_reminder_dispatch_log",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_streak_reminder_dispatch_log_user_id", table_name="streak_reminder_dispatch_log")
    op.drop_table("streak_reminder_dispatch_log")
