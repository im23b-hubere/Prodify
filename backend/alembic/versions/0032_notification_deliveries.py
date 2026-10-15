"""add notification_deliveries for push attribution

Revision ID: 0032_notification_deliveries
Revises: 0031_reports_and_suspension
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0032_notification_deliveries"
down_revision: Union[str, None] = "0031_reports_and_suspension"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notification_deliveries",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("notification_type", sa.String(length=48), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("delivered_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("app_opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("session_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("outcome", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("candidate_score", sa.Integer(), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("variables_json", sa.Text(), nullable=False, server_default="{}"),
    )
    op.create_index(
        "idx_notification_delivery_user_sent", "notification_deliveries", ["user_id", "sent_at"]
    )


def downgrade() -> None:
    op.drop_index("idx_notification_delivery_user_sent", table_name="notification_deliveries")
    op.drop_table("notification_deliveries")
