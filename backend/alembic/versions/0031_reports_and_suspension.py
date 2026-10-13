"""add content_reports and users.suspended_at for moderation (App Review Guideline 1.2)

Revision ID: 0031_reports_and_suspension
Revises: 0030_user_blocks
Create Date: 2026-10-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0031_reports_and_suspension"
down_revision: Union[str, None] = "0030_user_blocks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "content_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("reporter_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "reported_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("target_type", sa.String(length=16), nullable=False),
        sa.Column("comment_id", sa.Integer(), nullable=True),
        sa.Column("content_snapshot", sa.Text(), nullable=False),
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_content_reports_reporter_id", "content_reports", ["reporter_id"])
    op.create_index("ix_content_reports_reported_user_id", "content_reports", ["reported_user_id"])
    op.create_index("idx_content_reports_status_created", "content_reports", ["status", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_content_reports_status_created", table_name="content_reports")
    op.drop_index("ix_content_reports_reported_user_id", table_name="content_reports")
    op.drop_index("ix_content_reports_reporter_id", table_name="content_reports")
    op.drop_table("content_reports")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("suspended_at")
