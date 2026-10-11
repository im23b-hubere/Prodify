"""add friend_nudges for once-a-day friend nudges

Revision ID: 0028_friend_nudges
Revises: 0027_session_focus_assigned_seconds
Create Date: 2026-10-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0028_friend_nudges"
down_revision: Union[str, None] = "0027_session_focus_assigned_seconds"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "friend_nudges",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "sender_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recipient_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("day_key", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "sender_user_id", "recipient_user_id", "day_key", name="uq_friend_nudge_pair_day"
        ),
    )
    op.create_index("ix_friend_nudges_sender_user_id", "friend_nudges", ["sender_user_id"])
    op.create_index(
        "idx_friend_nudge_recipient_created", "friend_nudges", ["recipient_user_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("idx_friend_nudge_recipient_created", table_name="friend_nudges")
    op.drop_index("ix_friend_nudges_sender_user_id", table_name="friend_nudges")
    op.drop_table("friend_nudges")
