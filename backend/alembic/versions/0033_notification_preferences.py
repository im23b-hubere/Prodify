"""add user_notification_preferences so the server honours notification settings

Revision ID: 0033_notification_preferences
Revises: 0032_notification_deliveries
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0033_notification_preferences"
down_revision: Union[str, None] = "0032_notification_deliveries"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_notification_preferences",
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("smart_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("streak_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("social_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("challenge_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("rank_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("reengagement_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("quiet_start_minute", sa.Integer(), nullable=False, server_default="1350"),
        sa.Column("quiet_end_minute", sa.Integer(), nullable=False, server_default="480"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("user_notification_preferences")
