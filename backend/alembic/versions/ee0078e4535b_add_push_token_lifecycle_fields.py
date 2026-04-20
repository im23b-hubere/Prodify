"""add push token lifecycle fields

Revision ID: ee0078e4535b
Revises: 6c1fc4e95e02
Create Date: 2026-04-20 18:15:27.985318

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ee0078e4535b'
down_revision: Union[str, None] = '6c1fc4e95e02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    now_expr = sa.text("CURRENT_TIMESTAMP")
    with op.batch_alter_table("push_tokens") as batch:
        batch.add_column(sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"))
        batch.add_column(sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False, server_default=now_expr))


def downgrade() -> None:
    with op.batch_alter_table("push_tokens") as batch:
        batch.drop_column("last_used_at")
        batch.drop_column("is_active")
