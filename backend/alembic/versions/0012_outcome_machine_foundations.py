"""outcome machine foundations

Revision ID: 0012_outcome_machine_foundations
Revises: 0011_user_profile_picture_url
Create Date: 2026-04-19 15:10:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_outcome_machine_foundations"
down_revision: Union[str, None] = "0011_user_profile_picture_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False, server_default="revenuecat"),
        sa.Column("entitlement", sa.String(length=32), nullable=False, server_default="free"),
        sa.Column("trial_active", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rc_app_user_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_user_subscriptions_user"),
    )
    op.create_index("ix_user_subscriptions_user_id", "user_subscriptions", ["user_id"])

    op.create_table(
        "user_progression",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("xp_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("current_level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("xp_to_next_level", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_user_progression_user"),
    )
    op.create_index("ix_user_progression_user_id", "user_progression", ["user_id"])

    op.create_table(
        "xp_ledger",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=128), nullable=True),
        sa.Column("xp_delta", sa.Integer(), nullable=False),
        sa.Column("meta_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_xp_ledger_user_id", "xp_ledger", ["user_id"])
    op.create_index("idx_xp_ledger_user_created", "xp_ledger", ["user_id", "created_at"])

    op.create_table(
        "growth_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("event_name", sa.String(length=96), nullable=False),
        sa.Column("event_props_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_growth_events_user_id", "growth_events", ["user_id"])
    op.create_index("idx_growth_event_name_created", "growth_events", ["event_name", "created_at"])
    op.create_index("idx_growth_event_user_created", "growth_events", ["user_id", "created_at"])

    op.create_table(
        "weekly_review_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_start", sa.String(length=10), nullable=False),
        sa.Column("week_end", sa.String(length=10), nullable=False),
        sa.Column("total_sessions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("insights_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("blockers_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("suggestions_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("ai_feedback", sa.String(length=2000), nullable=False, server_default=""),
        sa.Column("share_image_url", sa.String(length=512), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "week_start", name="uq_weekly_review_user_week"),
    )
    op.create_index("ix_weekly_review_snapshots_user_id", "weekly_review_snapshots", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_weekly_review_snapshots_user_id", table_name="weekly_review_snapshots")
    op.drop_table("weekly_review_snapshots")
    op.drop_index("idx_growth_event_user_created", table_name="growth_events")
    op.drop_index("idx_growth_event_name_created", table_name="growth_events")
    op.drop_index("ix_growth_events_user_id", table_name="growth_events")
    op.drop_table("growth_events")
    op.drop_index("idx_xp_ledger_user_created", table_name="xp_ledger")
    op.drop_index("ix_xp_ledger_user_id", table_name="xp_ledger")
    op.drop_table("xp_ledger")
    op.drop_index("ix_user_progression_user_id", table_name="user_progression")
    op.drop_table("user_progression")
    op.drop_index("ix_user_subscriptions_user_id", table_name="user_subscriptions")
    op.drop_table("user_subscriptions")
