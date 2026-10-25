"""Index the last two foreign keys without one

Deleting a session or a user checks every referencing row. Without these indexes Postgres
scans notification_deliveries (which grows with every push) once per deleted session.

Revision ID: 0041_foreign_key_indexes
Revises: 0040_social_db_audit
Create Date: 2026-10-25
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0041_foreign_key_indexes"
down_revision: Union[str, None] = "0040_social_db_audit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_notification_deliveries_session_id", "notification_deliveries", ["session_id"]
    )
    op.create_index("ix_content_reports_resolved_by_id", "content_reports", ["resolved_by_id"])


def downgrade() -> None:
    op.drop_index("ix_content_reports_resolved_by_id", table_name="content_reports")
    op.drop_index("ix_notification_deliveries_session_id", table_name="notification_deliveries")
