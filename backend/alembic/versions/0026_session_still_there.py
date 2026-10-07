"""add sessions.still_there_notified_at for the 3h running-session nudge

Revision ID: 0026_session_still_there
Revises: 0025_session_area_weights
Create Date: 2026-10-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0026_session_still_there"
down_revision: Union[str, None] = "0025_session_area_weights"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("still_there_notified_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sessions", "still_there_notified_at")
