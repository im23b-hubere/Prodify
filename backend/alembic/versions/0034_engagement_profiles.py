"""add user_engagement_profiles, the aggregated behaviour the engine decides on

Revision ID: 0034_engagement_profiles
Revises: 0033_notification_preferences
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0034_engagement_profiles"
down_revision: Union[str, None] = "0033_notification_preferences"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_engagement_profiles",
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("total_sessions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stage", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("session_hour_histogram_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("weekday_histogram_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("avg_sessions_per_week", sa.Float(), nullable=False, server_default="0"),
        sa.Column("avg_session_duration_minutes", sa.Float(), nullable=False, server_default="0"),
        sa.Column("last_session_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sessions_last_7_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sessions_previous_7_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("motivation_scores_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("fatigue_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("ignored_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("segment", sa.String(length=32), nullable=True),
        sa.Column("return_probability_24h", sa.Float(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("user_engagement_profiles")
