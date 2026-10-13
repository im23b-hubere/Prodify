"""rename the user_subscriptions entitlement value "free" to "inactive" (there is no free tier)

Revision ID: 0032_inactive_entitlement
Revises: 0031_reports_and_suspension
Create Date: 2026-10-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0032_inactive_entitlement"
down_revision: Union[str, None] = "0031_reports_and_suspension"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE user_subscriptions SET entitlement = 'inactive' WHERE entitlement = 'free'")
    with op.batch_alter_table("user_subscriptions") as batch_op:
        batch_op.alter_column(
            "entitlement",
            existing_type=sa.String(length=32),
            existing_nullable=False,
            server_default="inactive",
        )


def downgrade() -> None:
    with op.batch_alter_table("user_subscriptions") as batch_op:
        batch_op.alter_column(
            "entitlement",
            existing_type=sa.String(length=32),
            existing_nullable=False,
            server_default="free",
        )
    op.execute("UPDATE user_subscriptions SET entitlement = 'free' WHERE entitlement = 'inactive'")
