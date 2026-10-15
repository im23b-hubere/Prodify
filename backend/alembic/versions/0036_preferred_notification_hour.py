"""add user_engagement_profiles.preferred_notification_hour, the learned local send hour

Revision ID: 0036_preferred_notification_hour
Revises: 0035_leaderboard_snapshots
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0036_preferred_notification_hour"
down_revision: Union[str, None] = "0035_leaderboard_snapshots"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("user_engagement_profiles") as batch:
        batch.add_column(sa.Column("preferred_notification_hour", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("user_engagement_profiles") as batch:
        batch.drop_column("preferred_notification_hour")
