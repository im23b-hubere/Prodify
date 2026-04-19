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

    op.add_column("social_commitments", sa.Column("commitment_key", sa.String(length=32), nullable=False, server_default="sessions"))
    op.add_column("social_commitments", sa.Column("period_days", sa.Integer(), nullable=False, server_default="7"))
    op.drop_constraint("uq_social_commitment_user_week", "social_commitments", type_="unique")
    op.create_unique_constraint(
        "uq_social_commitment_user_week_key",
        "social_commitments",
        ["user_id", "week_start", "commitment_key"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_social_commitment_user_week_key", "social_commitments", type_="unique")
    op.create_unique_constraint("uq_social_commitment_user_week", "social_commitments", ["user_id", "week_start"])
    op.drop_column("social_commitments", "period_days")
    op.drop_column("social_commitments", "commitment_key")
    op.drop_column("users", "bonus_challenge_slots")
    op.drop_column("users", "bonus_rescues")
    op.drop_column("users", "premium_until")
    op.drop_column("users", "is_premium")
