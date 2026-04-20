"""add performance indices

Revision ID: 6c1fc4e95e02
Revises: 0015_premium_growth_soft_limits
Create Date: 2026-04-20 17:16:43.357207

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '6c1fc4e95e02'
down_revision: Union[str, None] = '0015_premium_growth_soft_limits'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "idx_sessions_user_started",
        "sessions",
        ["user_id", "started_at"],
        unique=False,
    )
    op.create_index(
        "idx_friendships_users",
        "friendships",
        ["user_id", "friend_id"],
        unique=False,
    )
    op.create_index(
        "idx_friendships_status",
        "friendships",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_friendships_status", table_name="friendships")
    op.drop_index("idx_friendships_users", table_name="friendships")
    op.drop_index("idx_sessions_user_started", table_name="sessions")
