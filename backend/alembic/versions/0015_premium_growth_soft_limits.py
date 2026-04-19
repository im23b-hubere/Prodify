"""premium growth soft limits

Revision ID: 0015_premium_growth_soft_limits
Revises: 0014_social_depth
Create Date: 2026-04-19 18:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0015_premium_growth_soft_limits"
down_revision: Union[str, None] = "0014_social_depth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(inspector, table: str) -> set[str]:
    return {c["name"] for c in inspector.get_columns(table)}


def _unique_constraint_names(inspector, table: str) -> set[str]:
    return {u["name"] for u in inspector.get_unique_constraints(table) if u.get("name")}


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    users = _column_names(insp, "users")
    if "is_premium" not in users:
        op.add_column("users", sa.Column("is_premium", sa.Integer(), nullable=False, server_default="0"))
    if "premium_until" not in users:
        op.add_column("users", sa.Column("premium_until", sa.DateTime(timezone=True), nullable=True))
    if "bonus_rescues" not in users:
        op.add_column("users", sa.Column("bonus_rescues", sa.Integer(), nullable=False, server_default="0"))
    if "bonus_challenge_slots" not in users:
        op.add_column("users", sa.Column("bonus_challenge_slots", sa.Integer(), nullable=False, server_default="0"))

    # Recover from a failed first run: user columns may exist while revision is still 0014.
    sc_cols = _column_names(insp, "social_commitments")
    uq_names = _unique_constraint_names(insp, "social_commitments")
    if "uq_social_commitment_user_week_key" in uq_names:
        return

    # SQLite cannot DROP/ADD unique constraints with plain ALTER; batch mode rebuilds the table.
    with op.batch_alter_table("social_commitments", schema=None) as batch_op:
        if "commitment_key" not in sc_cols:
            batch_op.add_column(sa.Column("commitment_key", sa.String(length=32), nullable=False, server_default="sessions"))
        if "period_days" not in sc_cols:
            batch_op.add_column(sa.Column("period_days", sa.Integer(), nullable=False, server_default="7"))
        if "uq_social_commitment_user_week" in uq_names:
            batch_op.drop_constraint("uq_social_commitment_user_week", type_="unique")
        batch_op.create_unique_constraint(
            "uq_social_commitment_user_week_key",
            ["user_id", "week_start", "commitment_key"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    users = _column_names(insp, "users")
    uq_names = _unique_constraint_names(insp, "social_commitments")
    sc_cols = _column_names(insp, "social_commitments")

    if "uq_social_commitment_user_week_key" in uq_names:
        with op.batch_alter_table("social_commitments", schema=None) as batch_op:
            batch_op.drop_constraint("uq_social_commitment_user_week_key", type_="unique")
            batch_op.create_unique_constraint("uq_social_commitment_user_week", ["user_id", "week_start"])
            if "period_days" in sc_cols:
                batch_op.drop_column("period_days")
            if "commitment_key" in sc_cols:
                batch_op.drop_column("commitment_key")

    if "bonus_challenge_slots" in users:
        op.drop_column("users", "bonus_challenge_slots")
    if "bonus_rescues" in users:
        op.drop_column("users", "bonus_rescues")
    if "premium_until" in users:
        op.drop_column("users", "premium_until")
    if "is_premium" in users:
        op.drop_column("users", "is_premium")
