"""merge alembic heads (inactive entitlement + engagement return outlook)

Revision ID: 0038_merge_heads
Revises: 0032_inactive_entitlement, 0037_return_outlook
Create Date: 2026-10-15

"""

from typing import Sequence, Union

revision: str = "0038_merge_heads"
down_revision: Union[str, tuple[str, ...], None] = (
    "0032_inactive_entitlement",
    "0037_return_outlook",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
