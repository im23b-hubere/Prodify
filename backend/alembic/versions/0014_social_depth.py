"""social depth foundations

Revision ID: 0014_social_depth
Revises: 0013_challenges_checkins
Create Date: 2026-04-19 16:25:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014_social_depth"
down_revision: Union[str, None] = "0013_challenges_checkins"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "buddy_relationships",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("requester_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("addressee_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("requester_id", "addressee_id", name="uq_buddy_pair"),
        sa.UniqueConstraint("requester_id", name="uq_buddy_requester_single"),
        sa.UniqueConstraint("addressee_id", name="uq_buddy_addressee_single"),
    )
    op.create_index("ix_buddy_relationships_requester_id", "buddy_relationships", ["requester_id"])
    op.create_index("ix_buddy_relationships_addressee_id", "buddy_relationships", ["addressee_id"])

    op.create_table(
        "checkin_plans",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_start", sa.String(length=10), nullable=False),
        sa.Column("target_checkins", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "week_start", name="uq_checkin_plan_user_week"),
    )
    op.create_index("ix_checkin_plans_user_id", "checkin_plans", ["user_id"])

    op.create_table(
        "checkin_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_key", sa.String(length=10), nullable=False),
        sa.Column("state", sa.String(length=20), nullable=False, server_default="done"),
        sa.Column("note", sa.String(length=280), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "day_key", name="uq_checkin_log_user_day"),
    )
    op.create_index("ix_checkin_logs_user_id", "checkin_logs", ["user_id"])

    op.create_table(
        "social_comments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("target_type", sa.String(length=32), nullable=False, server_default="session"),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.String(length=400), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_social_comments_target_id", "social_comments", ["target_id"])
    op.create_index("ix_social_comments_author_id", "social_comments", ["author_id"])
    op.create_index(
        "idx_social_comments_target_created",
        "social_comments",
        ["target_type", "target_id", "created_at"],
    )

    op.create_table(
        "social_reactions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("target_type", sa.String(length=32), nullable=False, server_default="session"),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("emoji", sa.String(length=16), nullable=False, server_default="👍"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("target_type", "target_id", "user_id", "emoji", name="uq_social_reaction_unique"),
    )
    op.create_index("ix_social_reactions_target_id", "social_reactions", ["target_id"])
    op.create_index("ix_social_reactions_user_id", "social_reactions", ["user_id"])
    op.create_index("idx_social_reactions_target", "social_reactions", ["target_type", "target_id"])

    op.create_table(
        "social_challenges",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("challenge_kind", sa.String(length=20), nullable=False, server_default="duel"),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("week_start", sa.String(length=10), nullable=False),
        sa.Column("target_sessions", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("meta_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_social_challenges_owner_id", "social_challenges", ["owner_id"])
    op.create_index("idx_social_challenges_status_week", "social_challenges", ["status", "week_start"])

    op.create_table(
        "social_challenge_members",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "challenge_id",
            sa.Integer(),
            sa.ForeignKey("social_challenges.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("progress_sessions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("team_label", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("challenge_id", "user_id", name="uq_social_challenge_member"),
    )
    op.create_index("ix_social_challenge_members_challenge_id", "social_challenge_members", ["challenge_id"])
    op.create_index("ix_social_challenge_members_user_id", "social_challenge_members", ["user_id"])
    op.create_index(
        "idx_social_challenge_member_score",
        "social_challenge_members",
        ["challenge_id", "progress_sessions"],
    )

    op.create_table(
        "social_commitments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_start", sa.String(length=10), nullable=False),
        sa.Column("target_sessions", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("visibility", sa.String(length=20), nullable=False, server_default="friends"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "week_start", name="uq_social_commitment_user_week"),
    )
    op.create_index("ix_social_commitments_user_id", "social_commitments", ["user_id"])

    op.create_table(
        "streak_rescues",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("rescued_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rescuer_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_key", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("rescued_user_id", "day_key", name="uq_streak_rescue_day"),
    )
    op.create_index("ix_streak_rescues_rescued_user_id", "streak_rescues", ["rescued_user_id"])
    op.create_index("ix_streak_rescues_rescuer_user_id", "streak_rescues", ["rescuer_user_id"])
    op.create_index(
        "idx_streak_rescue_rescuer_created",
        "streak_rescues",
        ["rescuer_user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_streak_rescue_rescuer_created", table_name="streak_rescues")
    op.drop_index("ix_streak_rescues_rescuer_user_id", table_name="streak_rescues")
    op.drop_index("ix_streak_rescues_rescued_user_id", table_name="streak_rescues")
    op.drop_table("streak_rescues")
    op.drop_index("ix_social_commitments_user_id", table_name="social_commitments")
    op.drop_table("social_commitments")
    op.drop_index("idx_social_challenge_member_score", table_name="social_challenge_members")
    op.drop_index("ix_social_challenge_members_user_id", table_name="social_challenge_members")
    op.drop_index("ix_social_challenge_members_challenge_id", table_name="social_challenge_members")
    op.drop_table("social_challenge_members")
    op.drop_index("idx_social_challenges_status_week", table_name="social_challenges")
    op.drop_index("ix_social_challenges_owner_id", table_name="social_challenges")
    op.drop_table("social_challenges")
    op.drop_index("idx_social_reactions_target", table_name="social_reactions")
    op.drop_index("ix_social_reactions_user_id", table_name="social_reactions")
    op.drop_index("ix_social_reactions_target_id", table_name="social_reactions")
    op.drop_table("social_reactions")
    op.drop_index("idx_social_comments_target_created", table_name="social_comments")
    op.drop_index("ix_social_comments_author_id", table_name="social_comments")
    op.drop_index("ix_social_comments_target_id", table_name="social_comments")
    op.drop_table("social_comments")
    op.drop_index("ix_checkin_logs_user_id", table_name="checkin_logs")
    op.drop_table("checkin_logs")
    op.drop_index("ix_checkin_plans_user_id", table_name="checkin_plans")
    op.drop_table("checkin_plans")
    op.drop_index("ix_buddy_relationships_addressee_id", table_name="buddy_relationships")
    op.drop_index("ix_buddy_relationships_requester_id", table_name="buddy_relationships")
    op.drop_table("buddy_relationships")
