"""add user_blocks so users can block each other (App Review Guideline 1.2)

Revision ID: 0030_user_blocks
Revises: 0029_user_identities
Create Date: 2026-10-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0030_user_blocks"
down_revision: Union[str, None] = "0029_user_identities"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_blocks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("blocker_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("blocked_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("blocker_id", "blocked_id", name="uq_user_block_pair"),
    )
    op.create_index("ix_user_blocks_blocker_id", "user_blocks", ["blocker_id"])
    op.create_index("idx_user_blocks_blocked", "user_blocks", ["blocked_id"])


def downgrade() -> None:
    op.drop_index("idx_user_blocks_blocked", table_name="user_blocks")
    op.drop_index("ix_user_blocks_blocker_id", table_name="user_blocks")
    op.drop_table("user_blocks")
