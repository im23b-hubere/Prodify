"""add user profile picture URL column

Revision ID: 0011_user_profile_picture_url
Revises: 0010_session_type_slugs
Create Date: 2026-04-19 13:30:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_user_profile_picture_url"
down_revision: Union[str, None] = "0010_session_type_slugs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_picture_url", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "profile_picture_url")
