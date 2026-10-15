"""add the return outlook to user_engagement_profiles: last session length and yesterday's probability

Revision ID: 0037_return_outlook
Revises: 0036_preferred_notification_hour
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0037_return_outlook"
down_revision: Union[str, None] = "0036_preferred_notification_hour"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("user_engagement_profiles") as batch:
        batch.add_column(
            sa.Column("last_session_duration_minutes", sa.Float(), nullable=False, server_default="0")
        )
        batch.add_column(sa.Column("return_probability_day", sa.String(length=10), nullable=True))
        batch.add_column(sa.Column("previous_return_probability", sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("user_engagement_profiles") as batch:
        batch.drop_column("previous_return_probability")
        batch.drop_column("return_probability_day")
        batch.drop_column("last_session_duration_minutes")
