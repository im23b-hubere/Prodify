"""add leaderboard_snapshots, the last seen friend-leaderboard place per producer and week

Revision ID: 0035_leaderboard_snapshots
Revises: 0034_engagement_profiles
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0035_leaderboard_snapshots"
down_revision: Union[str, None] = "0034_engagement_profiles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "leaderboard_snapshots",
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("week_start", sa.String(length=10), primary_key=True),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("session_count", sa.Integer(), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("leaderboard_snapshots")
