"""premium growth soft limits

Revision ID: 0015_premium_growth_soft_limits
Revises: 0014_social_depth
Create Date: 2026-04-19 18:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015_premium_growth_soft_limits"
down_revision: Union[str, None] = "0014_social_depth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_premium", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("premium_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("bonus_rescues", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("bonus_challenge_slots", sa.Integer(), nullable=False, server_default="0"))

    # SQLite cannot DROP/ADD unique constraints with plain ALTER; batch mode rebuilds the table.
    with op.batch_alter_table("social_commitments", schema=None) as batch_op:
        batch_op.add_column(sa.Column("commitment_key", sa.String(length=32), nullable=False, server_default="sessions"))
        batch_op.add_column(sa.Column("period_days", sa.Integer(), nullable=False, server_default="7"))
        batch_op.drop_constraint("uq_social_commitment_user_week", type_="unique")
        batch_op.create_unique_constraint(
            "uq_social_commitment_user_week_key",
            ["user_id", "week_start", "commitment_key"],
        )


def downgrade() -> None:
    with op.batch_alter_table("social_commitments", schema=None) as batch_op:
        batch_op.drop_constraint("uq_social_commitment_user_week_key", type_="unique")
        batch_op.create_unique_constraint("uq_social_commitment_user_week", ["user_id", "week_start"])
        batch_op.drop_column("period_days")
        batch_op.drop_column("commitment_key")
    op.drop_column("users", "bonus_challenge_slots")
    op.drop_column("users", "bonus_rescues")
    op.drop_column("users", "premium_until")
    op.drop_column("users", "is_premium")
