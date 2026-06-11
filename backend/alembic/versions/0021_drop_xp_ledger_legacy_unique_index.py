"""drop legacy xp_ledger unique index superseded by partial idempotent index

Revision ID: 0021_drop_xp_ledger_legacy_unique
Revises: 0020_xp_ledger_idempotent_unique
Create Date: 2026-06-11

"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "0021_drop_xp_ledger_legacy_unique"
down_revision: Union[str, tuple[str, ...], None] = "0020_xp_ledger_idempotent_unique"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    idxs = {i.get("name") for i in insp.get_indexes("xp_ledger")}
    if "uq_xp_ledger_user_source_event" in idxs:
        op.drop_index("uq_xp_ledger_user_source_event", table_name="xp_ledger")


def downgrade() -> None:
    import sqlalchemy as sa

    bind = op.get_bind()
    dialect = bind.dialect.name
    insp = inspect(bind)
    idxs = {i.get("name") for i in insp.get_indexes("xp_ledger")}
    if "uq_xp_ledger_user_source_event" in idxs:
        return
    if dialect == "postgresql":
        op.create_index(
            "uq_xp_ledger_user_source_event",
            "xp_ledger",
            ["user_id", "source_type", "source_id"],
            unique=True,
            postgresql_where=sa.text("source_id IS NOT NULL"),
        )
    else:
        op.create_index(
            "uq_xp_ledger_user_source_event",
            "xp_ledger",
            ["user_id", "source_type", "source_id"],
            unique=True,
            sqlite_where=sa.text("source_id IS NOT NULL"),
        )
