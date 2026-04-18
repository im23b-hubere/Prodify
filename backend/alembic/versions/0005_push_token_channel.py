"""push_tokens: channel for Expo vs FCM

Revision ID: 0005_push_token_channel
Revises: 0004_engagement_tables
Create Date: 2026-04-18 18:00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_push_token_channel"
down_revision: Union[str, None] = "0004_engagement_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("push_tokens") as batch:
        batch.add_column(
            sa.Column("channel", sa.String(length=16), nullable=False, server_default="expo"),
        )
        batch.drop_constraint("uq_push_tokens_user_token", type_="unique")
        batch.create_unique_constraint(
            "uq_push_tokens_user_token_channel",
            ["user_id", "token", "channel"],
        )


def downgrade() -> None:
    with op.batch_alter_table("push_tokens") as batch:
        batch.drop_constraint("uq_push_tokens_user_token_channel", type_="unique")
        batch.create_unique_constraint("uq_push_tokens_user_token", ["user_id", "token"])
        batch.drop_column("channel")
