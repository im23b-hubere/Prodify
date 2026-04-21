"""merge alembic heads (ee0078 push token lifecycle + 0017 audit hardening)

Revision ID: 0018_merge_heads
Revises: 0017_audit_hardening, ee0078e4535b
Create Date: 2026-04-21

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0018_merge_heads"
down_revision: Union[str, tuple[str, ...], None] = ("0017_audit_hardening", "ee0078e4535b")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
