"""add per-weekday learned send hours on user_engagement_profiles

Revision ID: 0039_notification_slots
Revises: 0038_merge_heads
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0039_notification_slots"
down_revision: Union[str, None] = "0038_merge_heads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("user_engagement_profiles") as batch:
        batch.add_column(
            sa.Column("preferred_notification_slots_json", sa.Text(), nullable=False, server_default="{}")
        )


def downgrade() -> None:
    with op.batch_alter_table("user_engagement_profiles") as batch:
        batch.drop_column("preferred_notification_slots_json")
