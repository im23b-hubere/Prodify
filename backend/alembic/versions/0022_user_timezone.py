"""add user timezone column for calendar-day streak boundaries

Revision ID: 0022_user_timezone
Revises: 0021_drop_xp_ledger_legacy_uq
Create Date: 2026-09-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0022_user_timezone"
down_revision: Union[str, None] = "0021_drop_xp_ledger_legacy_uq"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable on purpose: existing users keep UTC day boundaries until their device
    # reports a zone, which avoids a one-off streak shift at deploy time.
    op.add_column("users", sa.Column("timezone", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "timezone")
