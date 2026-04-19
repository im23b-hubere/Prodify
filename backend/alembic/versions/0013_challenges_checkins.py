"""challenges and checkins tables

Revision ID: 0013_challenges_checkins
Revises: 0012_outcome_machine_foundations
Create Date: 2026-04-19 15:18:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_challenges_checkins"
down_revision: Union[str, None] = "0012_outcome_machine_foundations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "public_goals",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_start", sa.String(length=10), nullable=False),
        sa.Column("target_sessions", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("is_public", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "week_start", name="uq_public_goals_user_week"),
    )
    op.create_index("ix_public_goals_user_id", "public_goals", ["user_id"])

    op.create_table(
        "weekly_challenges",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("week_start", sa.String(length=10), nullable=False),
        sa.Column("challenge_type", sa.String(length=64), nullable=False, server_default="session_count"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("config_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_weekly_challenges_week_start", "weekly_challenges", ["week_start"])

    op.create_table(
        "challenge_participants",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "challenge_id",
            sa.Integer(),
            sa.ForeignKey("weekly_challenges.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("challenge_id", "user_id", name="uq_challenge_participants"),
    )
    op.create_index("ix_challenge_participants_challenge_id", "challenge_participants", ["challenge_id"])
    op.create_index("ix_challenge_participants_user_id", "challenge_participants", ["user_id"])
    op.create_index(
        "idx_challenge_participants_challenge_score",
        "challenge_participants",
        ["challenge_id", "score"],
    )

    op.create_table(
        "weekly_checkins",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_start", sa.String(length=10), nullable=False),
        sa.Column("did_ship", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("shipped_note", sa.String(length=280), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "week_start", name="uq_weekly_checkins_user_week"),
    )
    op.create_index("ix_weekly_checkins_user_id", "weekly_checkins", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_weekly_checkins_user_id", table_name="weekly_checkins")
    op.drop_table("weekly_checkins")
    op.drop_index("idx_challenge_participants_challenge_score", table_name="challenge_participants")
    op.drop_index("ix_challenge_participants_user_id", table_name="challenge_participants")
    op.drop_index("ix_challenge_participants_challenge_id", table_name="challenge_participants")
    op.drop_table("challenge_participants")
    op.drop_index("ix_weekly_challenges_week_start", table_name="weekly_challenges")
    op.drop_table("weekly_challenges")
    op.drop_index("ix_public_goals_user_id", table_name="public_goals")
    op.drop_table("public_goals")
