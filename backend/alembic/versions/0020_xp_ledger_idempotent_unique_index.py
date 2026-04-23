"""add xp ledger idempotent unique index

Revision ID: 0020_xp_ledger_idempotent_unique
Revises: 0019_notification_read_state
Create Date: 2026-04-23

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0020_xp_ledger_idempotent_unique"
down_revision: Union[str, tuple[str, ...], None] = "0019_notification_read_state"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_xp_ledger_idempotent_source",
        "xp_ledger",
        ["user_id", "source_type", "source_id"],
        unique=True,
        sqlite_where=sa.text("source_id IS NOT NULL AND source_type != 'inactivity_decay'"),
        postgresql_where=sa.text("source_id IS NOT NULL AND source_type != 'inactivity_decay'"),
    )


def downgrade() -> None:
    op.drop_index("uq_xp_ledger_idempotent_source", table_name="xp_ledger")
