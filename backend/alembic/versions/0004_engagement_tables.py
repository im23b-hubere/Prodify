"""engagement: push tokens, goals, achievements

Revision ID: 0004_engagement_tables
Revises: 0003_streak_freeze_fields
Create Date: 2026-04-18 14:00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_engagement_tables"
down_revision: Union[str, None] = "0003_streak_freeze_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "push_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("token", sa.String(length=512), nullable=False),
        sa.Column("platform", sa.String(length=32), nullable=False, server_default="unknown"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "token", name="uq_push_tokens_user_token"),
    )
    op.create_table(
        "user_goals",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("goal_type", sa.String(length=64), nullable=False),
        sa.Column("target_value", sa.Integer(), nullable=False),
        sa.Column("week_start", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "goal_type", "week_start", name="uq_user_goals_user_type_week"),
    )
    op.create_table(
        "user_achievements",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("achievement_type", sa.String(length=64), nullable=False),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "achievement_type", name="uq_user_achievements_user_type"),
    )


def downgrade() -> None:
    op.drop_table("user_achievements")
    op.drop_table("user_goals")
    op.drop_table("push_tokens")
