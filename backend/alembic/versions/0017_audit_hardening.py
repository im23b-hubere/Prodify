"""audit hardening: access token version, xp idempotency, streak break dedupe, analytics dedupe

Revision ID: 0017_audit_hardening
Revises: 0016_session_track_outcome
Create Date: 2026-04-21 12:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text

revision: str = "0017_audit_hardening"
down_revision: Union[str, None] = "0016_session_track_outcome"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    dialect = bind.dialect.name
    user_cols = {c["name"] for c in insp.get_columns("users")}
    if "access_token_version" not in user_cols:
        op.add_column(
            "users",
            sa.Column("access_token_version", sa.Integer(), nullable=False, server_default="0"),
        )
        # SQLite cannot ALTER COLUMN DROP DEFAULT; keep persistent default on local dev DB.
        if dialect != "sqlite":
            op.alter_column("users", "access_token_version", server_default=None)

    tables = insp.get_table_names()
    if "streak_break_notify_dedupe" not in tables:
        op.create_table(
            "streak_break_notify_dedupe",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("utc_day_key", sa.String(length=10), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("user_id", "utc_day_key", name="uq_streak_break_notify_user_day"),
        )
        op.create_index("ix_streak_break_notify_user", "streak_break_notify_dedupe", ["user_id"])

    if "analytics_event_dedupe" not in tables:
        op.create_table(
            "analytics_event_dedupe",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("bucket_key", sa.String(length=192), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("user_id", "bucket_key", name="uq_analytics_event_dedupe_user_bucket"),
        )
        op.create_index("ix_analytics_event_dedupe_user", "analytics_event_dedupe", ["user_id"])

    # Dedupe existing xp_ledger rows before unique index (keep lowest id per group).
    bind.execute(
        text(
            """
            DELETE FROM xp_ledger
            WHERE source_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM xp_ledger AS b
                WHERE b.source_id IS NOT NULL
                AND b.user_id = xp_ledger.user_id
                AND b.source_type = xp_ledger.source_type
                AND b.source_id = xp_ledger.source_id
                AND b.id < xp_ledger.id
            )
            """
        )
    )

    insp = inspect(bind)
    idxs = [i.get("name") for i in insp.get_indexes("xp_ledger")]
    if "uq_xp_ledger_user_source_event" not in idxs:
        if dialect == "postgresql":
            op.create_index(
                "uq_xp_ledger_user_source_event",
                "xp_ledger",
                ["user_id", "source_type", "source_id"],
                unique=True,
                postgresql_where=sa.text("source_id IS NOT NULL"),
            )
        else:
            op.create_index(
                "uq_xp_ledger_user_source_event",
                "xp_ledger",
                ["user_id", "source_type", "source_id"],
                unique=True,
                sqlite_where=sa.text("source_id IS NOT NULL"),
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    idxs = [i.get("name") for i in insp.get_indexes("xp_ledger")]
    if "uq_xp_ledger_user_source_event" in idxs:
        op.drop_index("uq_xp_ledger_user_source_event", table_name="xp_ledger")
    tables = insp.get_table_names()
    if "analytics_event_dedupe" in tables:
        op.drop_table("analytics_event_dedupe")
    if "streak_break_notify_dedupe" in tables:
        op.drop_table("streak_break_notify_dedupe")
    user_cols = {c["name"] for c in insp.get_columns("users")}
    if "access_token_version" in user_cols:
        op.drop_column("users", "access_token_version")
