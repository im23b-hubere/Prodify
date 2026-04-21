"""add track outcome fields to sessions

Revision ID: 0016_session_track_outcome
Revises: 0015_premium_growth_soft_limits
Create Date: 2026-04-21 10:40:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0016_session_track_outcome"
down_revision: Union[str, None] = "0015_premium_growth_soft_limits"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(inspector, table: str) -> set[str]:
    return {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    session_cols = _column_names(insp, "sessions")

    if "track_outcome" not in session_cols:
        op.add_column("sessions", sa.Column("track_outcome", sa.String(length=20), nullable=True))
    if "track_title" not in session_cols:
        op.add_column("sessions", sa.Column("track_title", sa.String(length=160), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    session_cols = _column_names(insp, "sessions")

    if "track_title" in session_cols:
        op.drop_column("sessions", "track_title")
    if "track_outcome" in session_cols:
        op.drop_column("sessions", "track_outcome")
