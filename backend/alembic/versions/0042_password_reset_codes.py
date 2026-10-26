"""add password_reset_codes for the emailed "forgot password" code

Revision ID: 0042_password_reset_codes
Revises: 0041_foreign_key_indexes
Create Date: 2026-10-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0042_password_reset_codes"
down_revision: Union[str, None] = "0041_foreign_key_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "password_reset_codes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_password_reset_codes_user_id", "password_reset_codes", ["user_id"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_password_reset_codes_user_id", table_name="password_reset_codes")
    op.drop_table("password_reset_codes")
